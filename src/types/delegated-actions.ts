import {
  DelegatedRiskLevel,
  IntegrationProvider,
  PendingApprovalStatus,
  PendingStepUpStatus,
} from "./auth-integrations";

export type DelegatedActionProvider = Extract<
  IntegrationProvider,
  "github" | "gitlab" | "slack"
>;

export type DelegatedActionExecutionMode = "live" | "fallback";

export type DelegatedActionExecutionStatus =
  | "proposed"
  | "awaiting_approval"
  | "awaiting_step_up"
  | "approved"
  | "running"
  | "completed"
  | "failed"
  | "rejected"
  | "expired"
  | "cancelled"
  | "blocked";

export type DelegatedActionMetadataValue =
  | string
  | number
  | boolean
  | null
  | string[]
  | number[]
  | boolean[];

export type DelegatedActionMetadata = Record<
  string,
  DelegatedActionMetadataValue
>;

export interface DelegatedActionExecution {
  id: string;
  taskId?: string;
  provider: DelegatedActionProvider;
  actionKey: string;
  riskLevel: DelegatedRiskLevel;
  mode: DelegatedActionExecutionMode;
  status: DelegatedActionExecutionStatus;
  approvalStatus: PendingApprovalStatus;
  stepUpStatus: PendingStepUpStatus;
  approvalRequestId?: string;
  stepUpRequirementId?: string;
  summary: string;
  logs: string[];
  externalRef?: string;
  externalUrl?: string;
  metadata: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}
