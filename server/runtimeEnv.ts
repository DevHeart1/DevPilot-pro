import { RuntimeEnv } from "./runtime.types";

export function createRuntimeEnv(): RuntimeEnv {
  return {
    port: Number(process.env.SECURE_ACTION_PORT ?? "3201"),
    frontendAppUrl: stripTrailingSlash(
      process.env.FRONTEND_APP_URL ?? "http://localhost:3000",
    ),
    secureActionBaseUrl: stripTrailingSlash(
      process.env.SECURE_ACTION_BASE_URL ?? "http://localhost:3201",
    ),
    gitlabUrl: stripTrailingSlash(
      process.env.VITE_GITLAB_URL ?? process.env.GITLAB_URL ?? "https://gitlab.com",
    ),
    auth0Domain: normalizeAuth0Domain(
      process.env.VITE_AUTH0_DOMAIN ?? process.env.AUTH0_DOMAIN ?? "",
    ),
    auth0ClientId:
      process.env.VITE_AUTH0_CLIENT_ID ?? process.env.AUTH0_CLIENT_ID ?? "",
    auth0ClientSecret: process.env.AUTH0_CLIENT_SECRET ?? "",
    auth0Audience:
      process.env.VITE_AUTH0_AUDIENCE ?? process.env.AUTH0_AUDIENCE ?? "",
    liveAuthMode: parseBooleanEnv(process.env.VITE_LIVE_AUTH_MODE),
    liveDelegatedActionMode: parseBooleanEnv(
      process.env.VITE_LIVE_DELEGATED_ACTION_MODE,
    ),
    liveAsyncAuthorizationMode: parseBooleanEnv(
      process.env.VITE_LIVE_ASYNC_AUTH_MODE ?? process.env.LIVE_ASYNC_AUTH_MODE,
    ),
    liveStepUpMode: parseBooleanEnv(
      process.env.VITE_LIVE_STEP_UP_MODE ?? process.env.LIVE_STEP_UP_MODE,
    ),
    liveGitHubActionMode: parseBooleanEnv(
      process.env.VITE_LIVE_GITHUB_ACTION_MODE,
    ),
    liveGitLabActionMode: parseBooleanEnv(
      process.env.VITE_LIVE_GITLAB_ACTION_MODE,
    ),
    liveSlackActionMode: parseBooleanEnv(
      process.env.VITE_LIVE_SLACK_ACTION_MODE,
    ),
    approvalTimeoutSeconds: Number(
      process.env.APPROVAL_TIMEOUT_SECONDS
      ?? process.env.VITE_APPROVAL_TIMEOUT_SECONDS
      ?? "900",
    ),
    asyncAuthorizationCallbackUrl:
      process.env.ASYNC_AUTH_CALLBACK_URL
      ?? process.env.VITE_ASYNC_AUTH_CALLBACK_URL
      ?? undefined,
    stepUpCallbackUrl:
      process.env.STEP_UP_CALLBACK_URL
      ?? process.env.VITE_STEP_UP_CALLBACK_URL
      ?? undefined,
    providerConnections: {
      github:
        process.env.AUTH0_TOKEN_VAULT_GITHUB_CONNECTION
        ?? process.env.VITE_AUTH0_TOKEN_VAULT_GITHUB_CONNECTION
        ?? "",
      gitlab:
        process.env.AUTH0_TOKEN_VAULT_GITLAB_CONNECTION
        ?? process.env.VITE_AUTH0_TOKEN_VAULT_GITLAB_CONNECTION
        ?? "",
      slack:
        process.env.AUTH0_TOKEN_VAULT_SLACK_CONNECTION
        ?? process.env.VITE_AUTH0_TOKEN_VAULT_SLACK_CONNECTION
        ?? "",
      google:
        process.env.AUTH0_TOKEN_VAULT_GOOGLE_CONNECTION
        ?? process.env.VITE_AUTH0_TOKEN_VAULT_GOOGLE_CONNECTION
        ?? "",
    },
    defaults: {
      githubOwner: process.env.VITE_DEFAULT_GITHUB_OWNER,
      githubRepo: process.env.VITE_DEFAULT_GITHUB_REPO,
      slackChannelId: process.env.VITE_DEFAULT_SLACK_CHANNEL_ID,
      slackChannelName: process.env.VITE_DEFAULT_SLACK_CHANNEL_NAME,
    },
    serverTokens: {
      gitlab: process.env.GITLAB_SERVICE_TOKEN ?? process.env.VITE_GITLAB_TOKEN,
    },
  };
}

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
