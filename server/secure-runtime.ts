import crypto from "node:crypto";
import dotenv from "dotenv";
import express, { Request, Response } from "express";
import {
  buildConnectedIntegrations,
  createPendingDelegatedAction,
  createSessionSnapshot,
  delegatedActionPolicies,
  getDelegatedActionPolicy,
} from "../src/lib/secure-actions/catalog";
import {
  AuthenticatedUserSummary,
  ConnectedIntegrationStatus,
  DelegatedActionPreviewInput,
  IntegrationProvider,
  PendingApprovalStatus,
  PendingDelegatedAction,
  PendingDelegatedActionUpdate,
  PendingStepUpStatus,
  SecureActionExecutionResult,
  SecureRuntimeSnapshot,
} from "../src/types";

dotenv.config();

const SESSION_COOKIE = "devpilot_secure_sid";
const app = express();

app.disable("x-powered-by");
app.use(express.json());

type RuntimeMode = "live" | "fallback";

interface RuntimeSessionRecord {
  id: string;
  status: "authenticated" | "anonymous";
  runtimeMode: RuntimeMode;
  createdAt: number;
  updatedAt: number;
  user?: AuthenticatedUserSummary;
  auth0Tokens?: {
    accessToken: string;
    refreshToken?: string;
    idToken?: string;
    expiresAt?: number;
  };
}

interface RuntimePendingActionRecord {
  sessionId: string;
  action: PendingDelegatedAction;
}

interface LoginStateRecord {
  sessionId: string;
  returnTo: string;
}

const sessionStore = new Map<string, RuntimeSessionRecord>();
const pendingActionStore = new Map<string, RuntimePendingActionRecord>();
const loginStateStore = new Map<string, LoginStateRecord>();

const runtimeEnv = {
  port: Number(process.env.SECURE_ACTION_PORT ?? "3201"),
  frontendAppUrl: stripTrailingSlash(
    process.env.FRONTEND_APP_URL ?? "http://localhost:3000",
  ),
  secureActionBaseUrl: stripTrailingSlash(
    process.env.SECURE_ACTION_BASE_URL ?? "http://localhost:3201",
  ),
  auth0Domain: normalizeAuth0Domain(
    process.env.VITE_AUTH0_DOMAIN ?? process.env.AUTH0_DOMAIN ?? "",
  ),
  auth0ClientId: process.env.VITE_AUTH0_CLIENT_ID ?? process.env.AUTH0_CLIENT_ID ?? "",
  auth0ClientSecret: process.env.AUTH0_CLIENT_SECRET ?? "",
  auth0Audience: process.env.VITE_AUTH0_AUDIENCE ?? process.env.AUTH0_AUDIENCE ?? "",
  liveAuthMode: parseBooleanEnv(process.env.VITE_LIVE_AUTH_MODE),
  liveDelegatedActionMode: parseBooleanEnv(
    process.env.VITE_LIVE_DELEGATED_ACTION_MODE,
  ),
  providerConnections: {
    github: process.env.AUTH0_TOKEN_VAULT_GITHUB_CONNECTION
      ?? process.env.VITE_AUTH0_TOKEN_VAULT_GITHUB_CONNECTION
      ?? "",
    gitlab: process.env.AUTH0_TOKEN_VAULT_GITLAB_CONNECTION
      ?? process.env.VITE_AUTH0_TOKEN_VAULT_GITLAB_CONNECTION
      ?? "",
    slack: process.env.AUTH0_TOKEN_VAULT_SLACK_CONNECTION
      ?? process.env.VITE_AUTH0_TOKEN_VAULT_SLACK_CONNECTION
      ?? "",
    google: process.env.AUTH0_TOKEN_VAULT_GOOGLE_CONNECTION
      ?? process.env.VITE_AUTH0_TOKEN_VAULT_GOOGLE_CONNECTION
      ?? "",
  },
};

app.use((request, response, next) => {
  const origin = resolveAllowedOrigin(request);
  response.header("Access-Control-Allow-Origin", origin);
  response.header("Vary", "Origin");
  response.header("Access-Control-Allow-Credentials", "true");
  response.header("Access-Control-Allow-Headers", "Content-Type");
  response.header("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");

  if (request.method === "OPTIONS") {
    response.sendStatus(204);
    return;
  }

  next();
});

app.get("/api/secure-runtime/health", (_request, response) => {
  response.json({
    data: {
      ok: true,
      liveAuthMode: runtimeEnv.liveAuthMode,
      liveDelegatedActionMode: runtimeEnv.liveDelegatedActionMode,
      auth0Configured: isAuth0Configured(),
    },
  });
});

app.get("/api/secure-runtime/snapshot", (request, response) => {
  const session = getOrCreateSession(request, response);
  response.json({ data: buildSnapshot(session) });
});

app.get("/api/secure-runtime/auth/login", async (request, response) => {
  const returnTo = sanitizeReturnTo(
    request.query.returnTo?.toString(),
    "/settings",
  );

  if (!runtimeEnv.liveAuthMode || !isAuth0Configured()) {
    const fallbackSession = getOrCreateSession(request, response);
    response.redirect(
      `${runtimeEnv.frontendAppUrl}${returnTo}?auth_mode=${fallbackSession.runtimeMode}`,
    );
    return;
  }

  const session = getOrCreateSession(request, response, {
    allowFallback: false,
  });
  const state = crypto.randomUUID();
  loginStateStore.set(state, {
    sessionId: session.id,
    returnTo,
  });

  const authorizeUrl = new URL(`${runtimeEnv.auth0Domain}/authorize`);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", runtimeEnv.auth0ClientId);
  authorizeUrl.searchParams.set("redirect_uri", getAuth0CallbackUrl());
  authorizeUrl.searchParams.set("scope", "openid profile email offline_access");
  authorizeUrl.searchParams.set("state", state);
  if (runtimeEnv.auth0Audience) {
    authorizeUrl.searchParams.set("audience", runtimeEnv.auth0Audience);
  }

  response.redirect(authorizeUrl.toString());
});

app.get("/api/secure-runtime/auth/callback", async (request, response) => {
  const code = request.query.code?.toString();
  const state = request.query.state?.toString();

  if (!code || !state || !loginStateStore.has(state)) {
    response.redirect(`${runtimeEnv.frontendAppUrl}/settings?auth_error=invalid_callback`);
    return;
  }

  const loginState = loginStateStore.get(state)!;
  loginStateStore.delete(state);

  try {
    const tokenResponse = await exchangeCodeForTokens(code);
    const user = await fetchUserProfile(tokenResponse.access_token);
    const session = sessionStore.get(loginState.sessionId)
      ?? createLiveAnonymousSession(loginState.sessionId);

    session.status = "authenticated";
    session.runtimeMode = "live";
    session.user = user;
    session.updatedAt = Date.now();
    session.auth0Tokens = {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      idToken: tokenResponse.id_token,
      expiresAt: tokenResponse.expires_in
        ? Date.now() + tokenResponse.expires_in * 1000
        : undefined,
    };

    sessionStore.set(session.id, session);
    setSessionCookie(response, session.id);
    response.redirect(`${runtimeEnv.frontendAppUrl}${loginState.returnTo}?auth=success`);
  } catch (error) {
    console.error("[secure-runtime] Auth0 callback failed:", error);
    response.redirect(`${runtimeEnv.frontendAppUrl}${loginState.returnTo}?auth_error=login_failed`);
  }
});

app.get("/api/secure-runtime/auth/logout", (request, response) => {
  const returnTo = sanitizeReturnTo(
    request.query.returnTo?.toString(),
    "/settings",
  );
  const sessionId = getSessionIdFromRequest(request);

  if (sessionId) {
    sessionStore.delete(sessionId);
    prunePendingActionsForSession(sessionId);
  }

  clearSessionCookie(response);

  if (runtimeEnv.liveAuthMode && isAuth0Configured()) {
    const logoutUrl = new URL(`${runtimeEnv.auth0Domain}/v2/logout`);
    logoutUrl.searchParams.set("client_id", runtimeEnv.auth0ClientId);
    logoutUrl.searchParams.set(
      "returnTo",
      `${runtimeEnv.frontendAppUrl}${returnTo}`,
    );
    response.redirect(logoutUrl.toString());
    return;
  }

  response.redirect(`${runtimeEnv.frontendAppUrl}${returnTo}?auth=logged_out`);
});

app.post("/api/secure-runtime/pending-actions/preview", (request, response) => {
  const session = getOrCreateSession(request, response);
  const input = validatePreviewInput(request.body);
  const policy = getDelegatedActionPolicy(input.provider, input.actionKey);

  if (!policy) {
    response.status(404).json({
      error: `Unknown delegated action policy for ${input.provider}:${input.actionKey}.`,
    });
    return;
  }

  const action = createPendingDelegatedAction(input, policy);
  pendingActionStore.set(action.id, { sessionId: session.id, action });

  response.status(201).json({ data: action });
});

app.patch("/api/secure-runtime/pending-actions/:id", (request, response) => {
  const session = getOrCreateSession(request, response);
  const record = pendingActionStore.get(request.params.id);

  if (!record || record.sessionId !== session.id) {
    response.status(404).json({ error: "Pending delegated action not found." });
    return;
  }

  const updates = validatePendingActionUpdate(request.body);
  const nextAction: PendingDelegatedAction = {
    ...record.action,
    ...updates,
    updatedAt: Date.now(),
  };

  pendingActionStore.set(nextAction.id, {
    sessionId: session.id,
    action: nextAction,
  });

  response.json({ data: nextAction });
});

app.post("/api/secure-runtime/pending-actions/:id/execute", (request, response) => {
  const session = getOrCreateSession(request, response);
  const record = pendingActionStore.get(request.params.id);

  if (!record || record.sessionId !== session.id) {
    response.status(404).json({ error: "Pending delegated action not found." });
    return;
  }

  const result = validateExecution(record.action, session);
  const statusCode = result.ok ? 200 : result.executionMode === "dry_run" ? 202 : 409;

  response.status(statusCode).json({ data: result });
});

app.use(
  (
    error: unknown,
    _request: Request,
    response: Response,
    _next: express.NextFunction,
  ) => {
    const message =
      error instanceof Error ? error.message : "Unknown secure runtime error.";
    response.status(400).json({ error: message });
  },
);

app.listen(runtimeEnv.port, () => {
  console.log(
    `[secure-runtime] Listening on ${runtimeEnv.secureActionBaseUrl} | liveAuth=${runtimeEnv.liveAuthMode} | liveDelegatedActions=${runtimeEnv.liveDelegatedActionMode}`,
  );
});

function parseBooleanEnv(value: string | undefined): boolean {
  return value === "true";
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/$/, "");
}

function normalizeAuth0Domain(domain: string): string {
  if (!domain) {
    return "";
  }

  const normalized = stripTrailingSlash(domain);
  return normalized.startsWith("http") ? normalized : `https://${normalized}`;
}

function resolveAllowedOrigin(request: Request): string {
  const requestOrigin = request.headers.origin;
  if (!requestOrigin) {
    return runtimeEnv.frontendAppUrl;
  }

  const allowed = new Set([
    runtimeEnv.frontendAppUrl,
    runtimeEnv.secureActionBaseUrl,
    "http://localhost:3000",
  ]);

  return allowed.has(requestOrigin) ? requestOrigin : runtimeEnv.frontendAppUrl;
}

function isAuth0Configured(): boolean {
  return Boolean(
    runtimeEnv.auth0Domain
    && runtimeEnv.auth0ClientId
    && runtimeEnv.auth0ClientSecret,
  );
}

function getAuth0CallbackUrl(): string {
  return `${runtimeEnv.secureActionBaseUrl}/api/secure-runtime/auth/callback`;
}

function sanitizeReturnTo(value: string | undefined, fallback: string): string {
  if (!value || !value.startsWith("/")) {
    return fallback;
  }

  return value;
}

function parseCookieHeader(header: string | undefined): Record<string, string> {
  if (!header) {
    return {};
  }

  return header.split(";").reduce<Record<string, string>>((cookies, segment) => {
    const [rawKey, ...rawValue] = segment.trim().split("=");
    if (!rawKey) {
      return cookies;
    }

    cookies[rawKey] = decodeURIComponent(rawValue.join("="));
    return cookies;
  }, {});
}

function getSessionIdFromRequest(request: Request): string | undefined {
  const cookies = parseCookieHeader(request.headers.cookie);
  return cookies[SESSION_COOKIE];
}

function setSessionCookie(response: Response, sessionId: string): void {
  response.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}`,
  );
}

function clearSessionCookie(response: Response): void {
  response.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
  );
}

function getOrCreateSession(
  request: Request,
  response: Response,
  options: { allowFallback?: boolean } = {},
): RuntimeSessionRecord {
  const sessionId = getSessionIdFromRequest(request);
  if (sessionId) {
    const existing = sessionStore.get(sessionId);
    if (existing) {
      existing.updatedAt = Date.now();
      return existing;
    }
  }

  const allowFallback = options.allowFallback ?? true;
  const nextSession = runtimeEnv.liveAuthMode && isAuth0Configured()
    ? createLiveAnonymousSession()
    : createFallbackSession();

  if (runtimeEnv.liveAuthMode && !allowFallback && !isAuth0Configured()) {
    const anonymousFallback = createLiveAnonymousSession();
    sessionStore.set(anonymousFallback.id, anonymousFallback);
    setSessionCookie(response, anonymousFallback.id);
    return anonymousFallback;
  }

  sessionStore.set(nextSession.id, nextSession);
  setSessionCookie(response, nextSession.id);
  return nextSession;
}

function createLiveAnonymousSession(existingId?: string): RuntimeSessionRecord {
  const now = Date.now();
  return {
    id: existingId ?? `session:${crypto.randomUUID()}`,
    status: "anonymous",
    runtimeMode: "live",
    createdAt: now,
    updatedAt: now,
  };
}

function createFallbackSession(): RuntimeSessionRecord {
  const now = Date.now();
  return {
    id: `session:${crypto.randomUUID()}`,
    status: "authenticated",
    runtimeMode: "fallback",
    createdAt: now,
    updatedAt: now,
    user: {
      sub: "fallback-local-operator",
      name: "Local DevPilot Operator",
      email: "local@devpilot.invalid",
    },
  };
}

function buildSnapshot(session: RuntimeSessionRecord): SecureRuntimeSnapshot {
  const updatedAt = Date.now();
  const liveAuthEnabled = runtimeEnv.liveAuthMode;
  const liveDelegatedActionEnabled = runtimeEnv.liveDelegatedActionMode;
  const auth0Configured = isAuth0Configured();
  const tokenVaultReady = Boolean(
    session.status === "authenticated"
    && session.auth0Tokens?.refreshToken
    && auth0Configured,
  );

  const sessionMessage = buildSessionMessage(session, tokenVaultReady);
  const sessionSnapshot = createSessionSnapshot({
    id: session.id,
    runtimeMode: session.runtimeMode,
    authenticated: session.status === "authenticated",
    isFallback: session.runtimeMode !== "live",
    auth0Configured,
    liveAuthEnabled,
    liveDelegatedActionEnabled,
    tokenVaultReady,
    domain: runtimeEnv.auth0Domain || undefined,
    audience: runtimeEnv.auth0Audience || undefined,
    user: session.user,
    message: sessionMessage,
    updatedAt,
  });

  return {
    session: sessionSnapshot,
    integrations: buildIntegrations(session, updatedAt),
    policies: delegatedActionPolicies,
    pendingActions: getPendingActionsForSession(session.id),
    runtimeMode: session.runtimeMode,
    warnings: buildWarnings(session, auth0Configured, tokenVaultReady),
    updatedAt,
  };
}

function buildWarnings(
  session: RuntimeSessionRecord,
  auth0Configured: boolean,
  tokenVaultReady: boolean,
): string[] {
  const warnings: string[] = [];

  if (session.runtimeMode === "fallback") {
    warnings.push(
      "Auth0 live configuration is unavailable. DevPilot is using a local fallback session and mock integration status.",
    );
  }

  if (runtimeEnv.liveAuthMode && !auth0Configured) {
    warnings.push(
      "Live Auth0 mode is enabled, but the secure runtime is missing domain, client ID, or client secret configuration.",
    );
  }

  if (session.runtimeMode === "live" && session.status === "anonymous") {
    warnings.push(
      "Sign in with Auth0 to enable user-bound delegated actions and future Token Vault token exchange.",
    );
  }

  if (!runtimeEnv.liveDelegatedActionMode) {
    warnings.push(
      "Delegated execution is in dry-run mode. Action previews, approvals, and risk boundaries are active, but provider calls remain blocked server-side.",
    );
  }

  if (session.status === "authenticated" && !tokenVaultReady) {
    warnings.push(
      "Token Vault exchange is not ready yet for this session. A refresh-token-backed Auth0 session is required for live delegated execution.",
    );
  }

  return warnings;
}

function buildSessionMessage(
  session: RuntimeSessionRecord,
  tokenVaultReady: boolean,
): string {
  if (session.runtimeMode === "fallback") {
    return "Local fallback session keeps DevPilot usable while secure delegated execution stays in dry-run mode.";
  }

  if (session.status === "anonymous") {
    return "Sign in to establish an Auth0-backed session and prepare Token Vault delegated actions.";
  }

  if (tokenVaultReady) {
    return "Auth0 session is active and the secure runtime is ready to exchange delegated tokens server-side.";
  }

  return "Auth0 session is active, but Token Vault token exchange still needs provider connection or refresh-token readiness.";
}

function buildIntegrations(
  session: RuntimeSessionRecord,
  updatedAt: number,
) {
  if (session.runtimeMode === "fallback") {
    return buildConnectedIntegrations({
      now: updatedAt,
      source: "mock",
      statusByProvider: {
        gitlab: "connected",
        github: "not_connected",
        slack: "expired",
        google: "connected",
      },
      accountIdentifiers: {
        gitlab: "devpilot/sandbox-workspace",
        google: session.user?.email,
      },
      connectedAtByProvider: {
        gitlab: updatedAt - 1000 * 60 * 60 * 24 * 4,
        google: updatedAt - 1000 * 60 * 60 * 10,
      },
    });
  }

  const providerStatuses: Partial<Record<IntegrationProvider, ConnectedIntegrationStatus>> = {
    gitlab: "not_connected",
    github: "not_connected",
    slack: "not_connected",
    google: session.status === "authenticated" ? "connected" : "not_connected",
  };

  return buildConnectedIntegrations({
    now: updatedAt,
    source: "auth0_token_vault",
    statusByProvider: providerStatuses,
    accountIdentifiers: {
      google: session.user?.email,
    },
    connectedAtByProvider: session.status === "authenticated"
      ? {
          google: updatedAt - 1000 * 60 * 15,
        }
      : undefined,
  });
}

function getPendingActionsForSession(sessionId: string): PendingDelegatedAction[] {
  return Array.from(pendingActionStore.values())
    .filter((record) => record.sessionId === sessionId)
    .map((record) => record.action)
    .sort((left, right) => right.updatedAt - left.updatedAt);
}

function prunePendingActionsForSession(sessionId: string): void {
  for (const [pendingId, record] of pendingActionStore.entries()) {
    if (record.sessionId === sessionId) {
      pendingActionStore.delete(pendingId);
    }
  }
}

function validatePreviewInput(body: unknown): DelegatedActionPreviewInput {
  const value = body as Partial<DelegatedActionPreviewInput> | null;
  if (!value || typeof value !== "object") {
    throw new Error("Delegated action preview payload is required.");
  }

  const provider = value.provider;
  const actionKey = value.actionKey;

  if (!isIntegrationProvider(provider)) {
    throw new Error("Unsupported provider.");
  }

  if (!actionKey || typeof actionKey !== "string") {
    throw new Error("actionKey is required.");
  }

  return {
    provider,
    actionKey,
    taskId: typeof value.taskId === "string" ? value.taskId : undefined,
    title: typeof value.title === "string" ? value.title : undefined,
    summary: typeof value.summary === "string" ? value.summary : undefined,
  };
}

function validatePendingActionUpdate(body: unknown): PendingDelegatedActionUpdate {
  const value = body as Partial<PendingDelegatedActionUpdate> | null;
  if (!value || typeof value !== "object") {
    throw new Error("Pending action update payload is required.");
  }

  const update: PendingDelegatedActionUpdate = {};

  if (value.approvalStatus !== undefined) {
    if (!isPendingApprovalStatus(value.approvalStatus)) {
      throw new Error("Invalid approvalStatus.");
    }
    update.approvalStatus = value.approvalStatus;
  }

  if (value.stepUpStatus !== undefined) {
    if (!isPendingStepUpStatus(value.stepUpStatus)) {
      throw new Error("Invalid stepUpStatus.");
    }
    update.stepUpStatus = value.stepUpStatus;
  }

  return update;
}

function validateExecution(
  action: PendingDelegatedAction,
  session: RuntimeSessionRecord,
): SecureActionExecutionResult {
  if (
    runtimeEnv.liveAuthMode
    && session.runtimeMode === "live"
    && session.status !== "authenticated"
  ) {
    return {
      ok: false,
      executionMode: "blocked",
      message: "Authentication is required before DevPilot can act on your behalf.",
      pendingAction: action,
    };
  }

  if (action.approvalStatus === "pending") {
    return {
      ok: false,
      executionMode: "blocked",
      message: "This action is still waiting for explicit approval.",
      pendingAction: action,
    };
  }

  if (action.approvalStatus === "rejected") {
    return {
      ok: false,
      executionMode: "blocked",
      message: "This action was rejected and cannot be executed.",
      pendingAction: action,
    };
  }

  if (action.stepUpStatus === "required") {
    return {
      ok: false,
      executionMode: "blocked",
      message: "Step-up authentication is required before this high-risk action can run.",
      pendingAction: action,
    };
  }

  if (!runtimeEnv.liveDelegatedActionMode) {
    return {
      ok: false,
      executionMode: "dry_run",
      message:
        "Delegated execution is disabled. The secure runtime validated this request but intentionally blocked the provider call.",
      pendingAction: action,
    };
  }

  if (!session.auth0Tokens?.refreshToken) {
    return {
      ok: false,
      executionMode: "blocked",
      message:
        "Token Vault delegation is not ready for this session because no refresh-token-backed Auth0 session is available.",
      pendingAction: action,
    };
  }

  return {
    ok: true,
    executionMode: "deferred",
    message:
      "Secure runtime validation passed. The next iteration can wire this action into Auth0 Token Vault provider token exchange.",
    pendingAction: action,
  };
}

function isIntegrationProvider(value: unknown): value is IntegrationProvider {
  return (
    value === "github"
    || value === "gitlab"
    || value === "slack"
    || value === "google"
  );
}

function isPendingApprovalStatus(value: unknown): value is PendingApprovalStatus {
  return (
    value === "not_required"
    || value === "pending"
    || value === "approved"
    || value === "rejected"
  );
}

function isPendingStepUpStatus(value: unknown): value is PendingStepUpStatus {
  return (
    value === "not_required"
    || value === "required"
    || value === "completed"
  );
}

async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  expires_in?: number;
}> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: runtimeEnv.auth0ClientId,
    client_secret: runtimeEnv.auth0ClientSecret,
    code,
    redirect_uri: getAuth0CallbackUrl(),
  });

  if (runtimeEnv.auth0Audience) {
    body.set("audience", runtimeEnv.auth0Audience);
  }

  const response = await fetch(`${runtimeEnv.auth0Domain}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Token exchange failed (${response.status}): ${details}`);
  }

  return (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    id_token?: string;
    expires_in?: number;
  };
}

async function fetchUserProfile(
  accessToken: string,
): Promise<AuthenticatedUserSummary> {
  const response = await fetch(`${runtimeEnv.auth0Domain}/userinfo`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Userinfo request failed (${response.status}): ${details}`);
  }

  const profile = (await response.json()) as {
    sub: string;
    name?: string;
    email?: string;
    picture?: string;
    nickname?: string;
  };

  return {
    sub: profile.sub,
    name: profile.name ?? profile.nickname ?? "Authenticated User",
    email: profile.email,
    pictureUrl: profile.picture,
  };
}
