import {
  DelegatedApprovalChannel,
  DelegatedRiskLevel,
  IntegrationProvider,
} from "./auth-integrations";
import { DelegatedActionExecution } from "./delegated-actions";
import { PendingDelegatedAction } from "./auth-integrations";

export type ApprovalRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "expired"
  | "cancelled";

export type StepUpRequirementStatus =
  | "not_required"
  | "required"
  | "in_progress"
  | "completed"
  | "failed";

export interface ApprovalRequest {
  id: string;
  taskId?: string;
  pendingActionId?: string;
  delegatedActionExecutionId?: string;
  provider: IntegrationProvider;
  actionKey: string;
  title: string;
  summary: string;
  riskLevel: DelegatedRiskLevel;
  requiredScopes: string[];
  approvalChannel: DelegatedApprovalChannel;
  status: ApprovalRequestStatus;
  requestedAt: number;
  respondedAt?: number;
  expiresAt?: number;
  metadata: string;
}

export interface StepUpRequirement {
  id: string;
  taskId?: string;
  pendingActionId?: string;
  delegatedActionExecutionId?: string;
  actionKey: string;
  provider: IntegrationProvider;
  required: boolean;
  reason: string;
  status: StepUpRequirementStatus;
  createdAt: number;
  updatedAt: number;
}

export interface ApprovalRequestTransitionResult {
  approvalRequest: ApprovalRequest;
  pendingAction?: PendingDelegatedAction;
  execution?: DelegatedActionExecution;
  stepUpRequirement?: StepUpRequirement;
  message: string;
}

export interface StepUpRequirementTransitionResult {
  stepUpRequirement: StepUpRequirement;
  pendingAction?: PendingDelegatedAction;
  execution?: DelegatedActionExecution;
  message: string;
}
