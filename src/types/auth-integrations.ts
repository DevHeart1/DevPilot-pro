export type IntegrationProvider = "github" | "gitlab" | "slack" | "google";

export type ConnectedIntegrationStatus =
  | "connected"
  | "not_connected"
  | "expired"
  | "error";

export type ConnectedIntegrationSource = "auth0_token_vault" | "mock";

export type DelegatedRiskLevel = "low" | "medium" | "high";

export type PendingApprovalStatus =
  | "not_required"
  | "pending"
  | "approved"
  | "rejected";

export type PendingStepUpStatus =
  | "not_required"
  | "required"
  | "completed";

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
}

export interface PendingDelegatedActionUpdate {
  approvalStatus?: PendingApprovalStatus;
  stepUpStatus?: PendingStepUpStatus;
}

export interface SecureActionExecutionResult {
  ok: boolean;
  pendingAction: PendingDelegatedAction;
  executionMode: "deferred" | "dry_run" | "blocked";
  message: string;
}
