import {
  buildConnectedIntegrations,
  createSessionSnapshot,
  delegatedActionPolicies,
} from "../../src/lib/secure-actions/catalog";
import {
  ApprovalRequest,
  DelegatedActionExecution,
  PendingDelegatedAction,
  SecureRuntimeSnapshot,
  StepUpRequirement,
} from "../../src/types";
import { githubActionService } from "./githubAction.service";
import { gitlabActionService } from "./gitlabAction.service";
import { slackActionService } from "./slackAction.service";
import { RuntimeEnv, RuntimeSessionRecord } from "../runtime.types";

export async function buildRuntimeSnapshot(options: {
  env: RuntimeEnv;
  session: RuntimeSessionRecord;
  pendingActions: PendingDelegatedAction[];
  executions: DelegatedActionExecution[];
  approvalRequests: ApprovalRequest[];
  stepUpRequirements: StepUpRequirement[];
}): Promise<SecureRuntimeSnapshot> {
  const {
    env,
    session,
    pendingActions,
    executions,
    approvalRequests,
    stepUpRequirements,
  } = options;
  const updatedAt = Date.now();
  const auth0Configured = Boolean(
    env.auth0Domain && env.auth0ClientId && env.auth0ClientSecret,
  );
  const tokenVaultReady = Boolean(
    session.status === "authenticated" &&
      session.auth0Tokens?.refreshToken &&
      auth0Configured,
  );

  if (session.runtimeMode === "fallback") {
    const sessionSnapshot = createSessionSnapshot({
      id: session.id,
      runtimeMode: session.runtimeMode,
      authenticated: true,
      isFallback: true,
      auth0Configured,
      liveAuthEnabled: env.liveAuthMode,
      liveDelegatedActionEnabled: env.liveDelegatedActionMode,
      liveAsyncAuthorizationEnabled: env.liveAsyncAuthorizationMode,
      liveStepUpEnabled: env.liveStepUpMode,
      tokenVaultReady: false,
      domain: env.auth0Domain || undefined,
      audience: env.auth0Audience || undefined,
      user: session.user,
      message:
        "Local fallback session keeps DevPilot operable while delegated providers run in secure fallback or blocked mode.",
      updatedAt,
    });

    return {
      session: sessionSnapshot,
      integrations: buildConnectedIntegrations({
        now: updatedAt,
        source: "mock",
        sourceByProvider: {
          gitlab: env.serverTokens.gitlab ? "secure_backend_fallback" : "mock",
        },
        statusByProvider: {
          gitlab: env.serverTokens.gitlab ? "connected" : "not_connected",
          github: "not_connected",
          slack: "not_connected",
          google: "connected",
        },
        accountIdentifiers: {
          gitlab: env.serverTokens.gitlab ? "secure-backend-fallback" : undefined,
          google: session.user?.email,
        },
        connectedAtByProvider: {
          gitlab: env.serverTokens.gitlab ? updatedAt - 1000 * 60 * 30 : undefined,
          google: updatedAt - 1000 * 60 * 15,
        },
      }),
      policies: delegatedActionPolicies,
      pendingActions,
      executions,
      approvalRequests,
      stepUpRequirements,
      runtimeMode: "fallback",
      warnings: buildWarnings({
        env,
        session,
        auth0Configured,
        tokenVaultReady,
      }),
      updatedAt,
    };
  }

  const [githubStatus, slackStatus, gitlabStatus] = await Promise.all([
    githubActionService.validateConnection({
      env,
      session,
      metadata: {},
    }),
    slackActionService.validateConnection({
      env,
      session,
      metadata: {},
    }),
    gitlabActionService.validateConnection({
      env,
      session,
      metadata: {},
    }),
  ]);

  const sessionSnapshot = createSessionSnapshot({
    id: session.id,
    runtimeMode: session.runtimeMode,
    authenticated: session.status === "authenticated",
    isFallback: false,
    auth0Configured,
    liveAuthEnabled: env.liveAuthMode,
    liveDelegatedActionEnabled: env.liveDelegatedActionMode,
    liveAsyncAuthorizationEnabled: env.liveAsyncAuthorizationMode,
    liveStepUpEnabled: env.liveStepUpMode,
    tokenVaultReady,
    domain: env.auth0Domain || undefined,
    audience: env.auth0Audience || undefined,
    user: session.user,
    message: buildSessionMessage(session, tokenVaultReady),
    updatedAt,
  });

  return {
    session: sessionSnapshot,
    integrations: buildConnectedIntegrations({
      now: updatedAt,
      source: "auth0_token_vault",
      sourceByProvider: {
        github: githubStatus.source,
        slack: slackStatus.source,
        gitlab: gitlabStatus.source,
        google: "auth0_token_vault",
      },
      statusByProvider: {
        github: githubStatus.status,
        slack: slackStatus.status,
        gitlab: gitlabStatus.status,
        google: session.status === "authenticated" ? "connected" : "not_connected",
      },
      accountIdentifiers: {
        github: githubStatus.accountIdentifier,
        slack: slackStatus.accountIdentifier,
        gitlab: gitlabStatus.accountIdentifier,
        google: session.user?.email,
      },
      connectedAtByProvider: {
        github: githubStatus.connectedAt,
        slack: slackStatus.connectedAt,
        gitlab: gitlabStatus.connectedAt,
        google: session.status === "authenticated" ? updatedAt - 1000 * 60 * 15 : undefined,
      },
    }),
    policies: delegatedActionPolicies,
    pendingActions,
    executions,
    approvalRequests,
    stepUpRequirements,
    runtimeMode: "live",
    warnings: buildWarnings({
      env,
      session,
      auth0Configured,
      tokenVaultReady,
      providerLogs: [
        ...githubStatus.logs,
        ...slackStatus.logs,
        ...gitlabStatus.logs,
      ],
    }),
    updatedAt,
  };
}

function buildWarnings(args: {
  env: RuntimeEnv;
  session: RuntimeSessionRecord;
  auth0Configured: boolean;
  tokenVaultReady: boolean;
  providerLogs?: string[];
}): string[] {
  const warnings: string[] = [];
  const { env, session, auth0Configured, tokenVaultReady } = args;

  if (session.runtimeMode === "fallback") {
    warnings.push(
      "Auth0 live configuration is unavailable, so DevPilot is using a fallback operator session and secure backend fallbacks where possible.",
    );
  }

  if (env.liveAuthMode && !auth0Configured) {
    warnings.push(
      "Live Auth0 mode is enabled, but the secure runtime is missing domain, client ID, or client secret configuration.",
    );
  }

  if (session.runtimeMode === "live" && session.status === "anonymous") {
    warnings.push(
      "Sign in with Auth0 to enable user-bound GitHub and Slack delegated actions through Token Vault.",
    );
  }

  if (!env.liveDelegatedActionMode) {
    warnings.push(
      "Delegated execution is globally disabled, so provider actions stay in preview or blocked fallback mode.",
    );
  }

  if (!env.liveAsyncAuthorizationMode) {
    warnings.push(
      "Async authorization is currently using in-app fallback approvals instead of a live Auth0 backchannel flow.",
    );
  }

  if (!env.liveStepUpMode) {
    warnings.push(
      "Step-up authentication is currently using local fallback checkpoints instead of a live step-up callback flow.",
    );
  }

  if (session.status === "authenticated" && !tokenVaultReady) {
    warnings.push(
      "Token Vault exchange is not ready for this session because no refresh-token-backed Auth0 session is available.",
    );
  }

  if (!env.liveGitHubActionMode) {
    warnings.push("GitHub delegated actions are disabled for this environment.");
  }

  if (!env.liveSlackActionMode) {
    warnings.push("Slack delegated actions are disabled for this environment.");
  }

  if (!env.serverTokens.gitlab) {
    warnings.push(
      "GitLab secure fallback actions are unavailable because no secure backend GitLab token is configured.",
    );
  }

  if (args.providerLogs?.some((log) => log.toLowerCase().includes("not_connected"))) {
    warnings.push(
      "One or more provider connections are missing or unavailable, so some delegated actions will be blocked until the connection is attached in Auth0.",
    );
  }

  return Array.from(new Set(warnings));
}

function buildSessionMessage(
  session: RuntimeSessionRecord,
  tokenVaultReady: boolean,
): string {
  if (session.status === "anonymous") {
    return "Sign in to establish an Auth0-backed session and enable GitHub or Slack delegated actions.";
  }

  if (tokenVaultReady) {
    return "Auth0 session is active and the secure runtime can exchange provider tokens server-side for delegated GitHub and Slack actions.";
  }

  return "Auth0 session is active, but delegated provider exchange still needs a refresh-token-backed login and connected accounts.";
}
