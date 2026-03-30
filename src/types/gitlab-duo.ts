export type DuoAgentRole = "ui_inspector" | "code_fixer" | "verifier" | "system";
export type DuoAgentType = "custom" | "standard";
export type DuoFlowStepKey =
  | "inspect_ui_issue"
  | "normalize_findings"
  | "infer_target_files"
  | "generate_fix_recommendation"
  | "prepare_patch_proposal"
  | "wait_for_approval"
  | "handoff_to_gitlab"
  | "apply_repository_mutation"
  | "monitor_pipeline"
  | "verify_fix"
  | "finalize_task";

export interface DuoFlowDefinition {
  id: string;
  name: string;
  description: string;
  steps: Array<{
    key: DuoFlowStepKey;
    agentRole: DuoAgentRole;
    description: string;
    isApprovalCheckpoint?: boolean;
  }>;
}

export interface DuoFlowRun {
  id: string; // Internal Dexie UUID
  taskId: string;
  flowRunId: string; // Real or Mock Duo Flow Run ID
  flowDefinitionId: string;
  currentStepKey: DuoFlowStepKey;
  status: "pending" | "running" | "paused" | "completed" | "failed";
  gitlabProjectRef?: string;
  gitlabContextRef?: string;
  startedAt: number;
  updatedAt: number;
  completedAt?: number;
}

export interface DuoAgentInvocation {
  id: string;
  flowRunId: string; // References DuoFlowRun.id
  taskId: string;
  agentRole: DuoAgentRole;
  stepKey: DuoFlowStepKey;
  invocationStatus: "pending" | "running" | "completed" | "failed";
  metadata: string; // JSON string payload
  startedAt: number;
  completedAt?: number;
}

export interface DuoApprovalCheckpoint {
  id: string;
  flowRunId: string;
  stepKey: DuoFlowStepKey;
  status: "pending" | "approved" | "rejected";
  requestedAt: number;
  resolvedAt?: number;
}

export interface DuoHandoffState {
  id: string;
  taskId: string;
  proposalId: string;
  flowRunId: string;
  branchName: string;
  mrUrl: string;
  status: "pending" | "success" | "failed";
  createdAt: number;
}
