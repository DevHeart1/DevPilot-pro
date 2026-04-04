export type IntegrationProvider = "github" | "gitlab" | "slack" | "google";

export type ConnectedIntegrationStatus =
  | "connected"
  | "not_connected"
  | "expired"
  | "error";

export type ConnectedIntegrationSource =
  | "auth0_token_vault"
  | "secure_backend_fallback"
  | "mock";

export type DelegatedRiskLevel = "low" | "medium" | "high";

export type DelegatedApprovalChannel = "in_app" | "email" | "push" | "unknown";

export type ApprovalTriggerType =
  | "never"
  | "write_requires_review"
  | "sensitive_scope"
  | "high_risk_write"
  | "channel_broadcast";

export type StepUpTriggerType =
  | "never"
  | "high_risk_scope"
  | "protected_resource"
  | "privileged_write";

export type DelegatedActionLifecycleStatus =
  | "proposed"
  | "awaiting_approval"
  | "awaiting_step_up"
  | "approved"
  | "executing"
  | "completed"
  | "rejected"
  | "expired"
  | "blocked"
  | "cancelled";

export type PendingApprovalStatus =
  | "not_required"
  | "pending"
  | "approved"
  | "rejected"
  | "expired"
  | "cancelled";

export type PendingStepUpStatus =
  | "not_required"
  | "required"
  | "in_progress"
  | "completed"
  | "failed";

export type SecureRuntimeMode = "live" | "fallback" | "mock";

export interface ConnectedIntegration {
  id: string;
  provider: IntegrationProvider;
  status: ConnectedIntegrationStatus;
  scopes: string[];
  displayName: string;
  accountIdentifier?: string;
  connectedAt?: number;
  updatedAt: number;
  source: ConnectedIntegrationSource;
}

export interface DelegatedActionPolicy {
  id: string;
  actionKey: string;
  provider: IntegrationProvider;
  riskLevel: DelegatedRiskLevel;
  requiresApproval: boolean;
  requiresStepUp: boolean;
  approvalTrigger: ApprovalTriggerType;
  stepUpTrigger: StepUpTriggerType;
  approvalChannel: DelegatedApprovalChannel;
  canRunInBackgroundBeforeApproval: boolean;
  safeToAutoExecute: boolean;
  approvalTimeoutSeconds?: number;
  approvalReason?: string;
  stepUpReason?: string;
  allowedScopes: string[];
  summary: string;
}

export interface PendingDelegatedAction {
  id: string;
  taskId?: string;
  provider: IntegrationProvider;
  actionKey: string;
  title: string;
  summary: string;
  riskLevel: DelegatedRiskLevel;
  requiredScopes: string[];
  approvalStatus: PendingApprovalStatus;
  stepUpStatus: PendingStepUpStatus;
  status: DelegatedActionLifecycleStatus;
  approvalRequestId?: string;
  stepUpRequirementId?: string;
  delegatedActionExecutionId?: string;
  metadata?: string;
  createdAt: number;
  updatedAt: number;
}

export interface AuthenticatedUserSummary {
  sub: string;
  name: string;
  email?: string;
  pictureUrl?: string;
}

export interface AuthSessionSnapshot {
  id: string;
  status: "authenticated" | "anonymous";
  runtimeMode: SecureRuntimeMode;
  isFallback: boolean;
  user?: AuthenticatedUserSummary;
  auth0: {
    configured: boolean;
    liveAuthEnabled: boolean;
    liveDelegatedActionEnabled: boolean;
    liveAsyncAuthorizationEnabled: boolean;
    liveStepUpEnabled: boolean;
    tokenVaultReady: boolean;
    domain?: string;
    audience?: string;
  };
  message: string;
  updatedAt: number;
}

export interface SecureRuntimeSnapshot {
  session: AuthSessionSnapshot;
  integrations: ConnectedIntegration[];
  policies: DelegatedActionPolicy[];
  pendingActions: PendingDelegatedAction[];
  executions: import("./delegated-actions").DelegatedActionExecution[];
  approvalRequests: import("./approvals").ApprovalRequest[];
  stepUpRequirements: import("./approvals").StepUpRequirement[];
  runtimeMode: SecureRuntimeMode;
  warnings: string[];
  updatedAt: number;
}

export interface DelegatedActionPreviewInput {
  taskId?: string;
  provider: IntegrationProvider;
  actionKey: string;
  title?: string;
  summary?: string;
  metadata?: import("./delegated-actions").DelegatedActionMetadata;
}

export interface PendingDelegatedActionUpdate {
  approvalStatus?: PendingApprovalStatus;
  stepUpStatus?: PendingStepUpStatus;
}

export interface SecureActionExecutionResult {
  ok: boolean;
  pendingAction?: PendingDelegatedAction;
  execution: import("./delegated-actions").DelegatedActionExecution;
  approvalRequest?: import("./approvals").ApprovalRequest;
  stepUpRequirement?: import("./approvals").StepUpRequirement;
  executionMode: "deferred" | "dry_run" | "blocked";
  message: string;
}
