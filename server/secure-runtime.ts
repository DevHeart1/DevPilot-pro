import crypto from "node:crypto";
import dotenv from "dotenv";
import express, { Request, Response } from "express";
import { setSession, getSession, deleteSession } from "./runtime.store";
import { createRuntimeEnv } from "./runtimeEnv";
import { createActionsRouter } from "./routes/actions";
import { createApprovalsRouter } from "./routes/approvals";
import { createAuthRouter } from "./routes/auth";
import { createIntegrationsRouter } from "./routes/integrations";
import { RuntimeSessionRecord } from "./runtime.types";

dotenv.config();

const SESSION_COOKIE = "devpilot_secure_sid";
const app = express();
const env = createRuntimeEnv();

app.disable("x-powered-by");
app.use(express.json());

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

app.use(
  createAuthRouter({
    env,
    getSession: getOrCreateSession,
    setSessionCookie,
    clearSessionCookie,
    deleteSession,
    createLiveAnonymousSession,
  }),
);
app.use(
  createIntegrationsRouter({
    env,
    getSession: getOrCreateSession,
  }),
);
app.use(
  createActionsRouter({
    env,
    getSession: getOrCreateSession,
  }),
);
app.use(
  createApprovalsRouter({
    env,
    getSession: getOrCreateSession,
  }),
);

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

app.listen(env.port, () => {
  console.log(
    `[secure-runtime] Listening on ${env.secureActionBaseUrl} | liveAuth=${env.liveAuthMode} | liveDelegatedActions=${env.liveDelegatedActionMode}`,
  );
});

function resolveAllowedOrigin(request: Request): string {
  const requestOrigin = request.headers.origin;
  if (!requestOrigin) {
    return env.frontendAppUrl;
  }

  const allowed = new Set([
    env.frontendAppUrl,
    env.secureActionBaseUrl,
    "http://localhost:3000",
  ]);

  return allowed.has(requestOrigin) ? requestOrigin : env.frontendAppUrl;
}

function getOrCreateSession(
  request: Request,
  response: Response,
  options: { allowFallback?: boolean } = {},
): RuntimeSessionRecord {
  const sessionId = getSessionIdFromRequest(request);
  if (sessionId) {
    const existing = getSession(sessionId);
    if (existing) {
      existing.updatedAt = Date.now();
      setSession(existing);
      return existing;
    }
  }

  const allowFallback = options.allowFallback ?? true;
  const nextSession =
    env.liveAuthMode && isAuth0Configured()
      ? createLiveAnonymousSession()
      : createFallbackSession();

  if (env.liveAuthMode && !allowFallback && !isAuth0Configured()) {
    const anonymousFallback = createLiveAnonymousSession();
    setSession(anonymousFallback);
    setSessionCookie(response, anonymousFallback.id);
    return anonymousFallback;
  }

  setSession(nextSession);
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

function getSessionIdFromRequest(request: Request): string | undefined {
  const cookies = parseCookieHeader(request.headers.cookie);
  return cookies[SESSION_COOKIE];
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

function isAuth0Configured(): boolean {
  return Boolean(env.auth0Domain && env.auth0ClientId && env.auth0ClientSecret);
}
