import {
  ApprovalRequest,
  AuthenticatedUserSummary,
  ConnectedIntegrationSource,
  ConnectedIntegrationStatus,
  DelegatedActionExecution,
  DelegatedActionExecutionMode,
  DelegatedActionExecutionStatus,
  DelegatedActionMetadata,
  DelegatedActionProvider,
  PendingDelegatedAction,
  StepUpRequirement,
} from "../src/types";

export type RuntimeMode = "live" | "fallback";

export interface RuntimeEnv {
  port: number;
  frontendAppUrl: string;
  secureActionBaseUrl: string;
  gitlabUrl: string;
  auth0Domain: string;
  auth0ClientId: string;
  auth0ClientSecret: string;
  auth0Audience: string;
  liveAuthMode: boolean;
  liveDelegatedActionMode: boolean;
  liveAsyncAuthorizationMode: boolean;
  liveStepUpMode: boolean;
  liveGitHubActionMode: boolean;
  liveGitLabActionMode: boolean;
  liveSlackActionMode: boolean;
  approvalTimeoutSeconds: number;
  asyncAuthorizationCallbackUrl?: string;
  stepUpCallbackUrl?: string;
  providerConnections: {
    github: string;
    gitlab: string;
    slack: string;
    google: string;
  };
  defaults: {
    githubOwner?: string;
    githubRepo?: string;
    slackChannelId?: string;
    slackChannelName?: string;
  };
  serverTokens: {
    gitlab?: string;
  };
}

export interface RuntimeSessionRecord {
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

export interface RuntimePendingActionRecord {
  sessionId: string;
  action: PendingDelegatedAction;
}

export interface RuntimeExecutionRecord {
  sessionId: string;
  execution: DelegatedActionExecution;
}

export interface RuntimeApprovalRequestRecord {
  sessionId: string;
  approvalRequest: ApprovalRequest;
}

export interface RuntimeStepUpRequirementRecord {
  sessionId: string;
  stepUpRequirement: StepUpRequirement;
}

export interface LoginStateRecord {
  sessionId: string;
  returnTo: string;
}

export interface ProviderConnectionResult {
  provider: DelegatedActionProvider;
  status: ConnectedIntegrationStatus;
  source: ConnectedIntegrationSource;
  accountIdentifier?: string;
  connectedAt?: number;
  logs: string[];
}

export interface ProviderActionContext {
  env: RuntimeEnv;
  session: RuntimeSessionRecord;
  metadata: DelegatedActionMetadata;
}

export interface ProviderActionOutcome {
  mode: DelegatedActionExecutionMode;
  status: DelegatedActionExecutionStatus;
  summary: string;
  logs: string[];
  externalRef?: string;
  externalUrl?: string;
  metadata?: Record<string, unknown>;
}
