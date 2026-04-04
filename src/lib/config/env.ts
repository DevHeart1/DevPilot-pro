type EnvRecord = Record<string, string | undefined>;

function getProcessEnv(): EnvRecord {
  if (typeof process === "undefined" || !process.env) {
    return {};
  }

  return process.env as EnvRecord;
}

function getImportMetaEnv(): EnvRecord {
  if (typeof import.meta === "undefined") {
    return {};
  }

  return (import.meta.env ?? {}) as EnvRecord;
}

function readEnv(key: string, defaultValue = ""): string {
  const processValue = getProcessEnv()[key];
  if (processValue && processValue.length > 0) {
    return processValue;
  }

  const viteValue = getImportMetaEnv()[key];
  if (viteValue && viteValue.length > 0) {
    return viteValue;
  }

  return defaultValue;
}

function readBooleanEnv(key: string, defaultValue = false): boolean {
  return readEnv(key, String(defaultValue)) === "true";
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/$/, "");
}

export const getEnvVar = readEnv;

export const config = {
  liveDuoExecution: readBooleanEnv("VITE_LIVE_DUO_EXECUTION"),
  gitlabDuoApiUrl: readEnv("VITE_GITLAB_DUO_API_URL", "https://gitlab.com/api/v4"),
  gitlabDuoToken: readEnv("VITE_GITLAB_DUO_TOKEN"),
  liveMode: readBooleanEnv("VITE_LIVE_MODE"),
  liveGitlabMode: readBooleanEnv("VITE_LIVE_GITLAB_MODE"),
  liveAuthMode: readBooleanEnv("VITE_LIVE_AUTH_MODE"),
  liveDelegatedActionMode: readBooleanEnv("VITE_LIVE_DELEGATED_ACTION_MODE"),
  liveAsyncAuthorizationMode: readBooleanEnv("VITE_LIVE_ASYNC_AUTH_MODE"),
  liveStepUpMode: readBooleanEnv("VITE_LIVE_STEP_UP_MODE"),
  liveGitHubActionMode: readBooleanEnv("VITE_LIVE_GITHUB_ACTION_MODE"),
  liveGitLabActionMode: readBooleanEnv("VITE_LIVE_GITLAB_ACTION_MODE"),
  liveSlackActionMode: readBooleanEnv("VITE_LIVE_SLACK_ACTION_MODE"),
  sandboxUrl: readEnv("VITE_SANDBOX_URL", "http://localhost:8080"),
  targetAppBaseUrl: readEnv("VITE_TARGET_APP_BASE_URL", "http://localhost:3000"),
  secureActionBffUrl: stripTrailingSlash(
    readEnv("VITE_SECURE_ACTION_BFF_URL", "http://localhost:3201"),
  ),

  auth0Domain: readEnv("VITE_AUTH0_DOMAIN"),
  auth0ClientId: readEnv("VITE_AUTH0_CLIENT_ID"),
  auth0Audience: readEnv("VITE_AUTH0_AUDIENCE"),
  approvalTimeoutSeconds: Number(readEnv("VITE_APPROVAL_TIMEOUT_SECONDS", "900")),
  asyncAuthorizationCallbackUrl: readEnv("VITE_ASYNC_AUTH_CALLBACK_URL"),
  stepUpCallbackUrl: readEnv("VITE_STEP_UP_CALLBACK_URL"),
  defaultGitHubOwner: readEnv("VITE_DEFAULT_GITHUB_OWNER"),
  defaultGitHubRepo: readEnv("VITE_DEFAULT_GITHUB_REPO"),
  defaultSlackChannelId: readEnv("VITE_DEFAULT_SLACK_CHANNEL_ID"),
  defaultSlackChannelName: readEnv("VITE_DEFAULT_SLACK_CHANNEL_NAME"),

  tokenVaultProviders: {
    githubConnection: readEnv("VITE_AUTH0_TOKEN_VAULT_GITHUB_CONNECTION"),
    gitlabConnection: readEnv("VITE_AUTH0_TOKEN_VAULT_GITLAB_CONNECTION"),
    slackConnection: readEnv("VITE_AUTH0_TOKEN_VAULT_SLACK_CONNECTION"),
    googleConnection: readEnv("VITE_AUTH0_TOKEN_VAULT_GOOGLE_CONNECTION"),
  },

  geminiApiKey: readEnv("VITE_GEMINI_API_KEY"),
  browserbaseApiKey: readEnv("VITE_BROWSERBASE_API_KEY"),
  browserbaseProjectId: readEnv("VITE_BROWSERBASE_PROJECT_ID"),

  gitlabUrl: readEnv("VITE_GITLAB_URL", "https://gitlab.com"),
  gitlabToken: readEnv("VITE_GITLAB_TOKEN"),
  gitlabProjectId: readEnv("VITE_GITLAB_PROJECT_ID"),
  gitlabDefaultBranch: readEnv("VITE_GITLAB_DEFAULT_BRANCH", "main"),

  liveRepositoryMode: readBooleanEnv("VITE_LIVE_REPOSITORY_MODE"),
  liveEventMode: readBooleanEnv("VITE_LIVE_EVENT_MODE"),
  webhookSecret: readEnv("VITE_GITLAB_WEBHOOK_SECRET"),

  get isGitLabConfigured() {
    return !!(this.liveRepositoryMode && this.gitlabToken);
  },
  get isProjectConfigured() {
    return !!(this.isGitLabConfigured && this.gitlabProjectId);
  },
  get isGeminiConfigured() {
    return !!(this.liveMode && this.geminiApiKey);
  },
  get isSandboxConfigured() {
    return !!this.sandboxUrl;
  },
  get isAuth0Configured() {
    return !!(this.liveAuthMode && this.auth0Domain && this.auth0ClientId);
  },
  get isSecureDelegatedActionConfigured() {
    return !!(this.liveDelegatedActionMode && this.auth0Domain && this.auth0ClientId);
  },
  get isGitHubDelegatedActionConfigured() {
    return !!(this.liveDelegatedActionMode && this.liveGitHubActionMode);
  },
  get isGitLabDelegatedActionConfigured() {
    return !!(this.liveDelegatedActionMode && this.liveGitLabActionMode);
  },
  get isSlackDelegatedActionConfigured() {
    return !!(this.liveDelegatedActionMode && this.liveSlackActionMode);
  },
};
