import crypto from "node:crypto";
import {
  createPendingDelegatedAction,
  getDelegatedActionPolicy,
} from "../../src/lib/secure-actions/catalog";
import {
  ApprovalRequest,
  DelegatedActionExecution,
  DelegatedActionExecutionStatus,
  DelegatedActionMetadata,
  DelegatedActionPreviewInput,
  PendingDelegatedAction,
  PendingDelegatedActionUpdate,
  SecureActionExecutionResult,
  StepUpRequirement,
} from "../../src/types";
import {
  deletePendingAction,
  getApprovalRequestForSession,
  getApprovalRequestsForSession,
  getExecutionForSession,
  getExecutionsForSession,
  getPendingActionForSession,
  getPendingActionsForSession,
  getStepUpRequirementForSession,
  getStepUpRequirementsForSession,
  storePendingAction,
  upsertExecution,
} from "../runtime.store";
import { RuntimeEnv, RuntimeSessionRecord } from "../runtime.types";
import { githubActionService } from "./githubAction.service";
import { gitlabActionService } from "./gitlabAction.service";
import { slackActionService } from "./slackAction.service";
import {
  approveApprovalRequestForSession,
  createApprovalRequestForPendingAction,
  expireApprovalRequestsForSession,
} from "./approval.service";
import {
  completeStepUpRequirementForSession,
  createStepUpRequirementForPendingAction,
} from "./stepUpAuth.service";

export function createPendingActionForSession(options: {
  env: RuntimeEnv;
  sessionId: string;
  input: DelegatedActionPreviewInput;
}): PendingDelegatedAction {
  const policy = getDelegatedActionPolicy(
    options.input.provider,
    options.input.actionKey,
  );
  if (!policy) {
    throw new Error(
      `Unknown delegated action policy for ${options.input.provider}:${options.input.actionKey}.`,
    );
  }

  const now = Date.now();
  let action = createPendingDelegatedAction(options.input, policy, now);
  const executionId = `execution:${crypto.randomUUID()}`;
  action = {
    ...action,
    delegatedActionExecutionId: executionId,
  };

  let approvalRequest: ApprovalRequest | undefined;
  let stepUpRequirement: StepUpRequirement | undefined;

  if (policy.requiresApproval) {
    approvalRequest = createApprovalRequestForPendingAction({
      env: options.env,
      sessionId: options.sessionId,
      pendingAction: action,
      policy,
      delegatedActionExecutionId: executionId,
      now,
    });
    action.approvalRequestId = approvalRequest.id;
  }

  if (policy.requiresStepUp) {
    stepUpRequirement = createStepUpRequirementForPendingAction({
      sessionId: options.sessionId,
      pendingAction: action,
      policy,
      delegatedActionExecutionId: executionId,
      now,
    });
    action.stepUpRequirementId = stepUpRequirement.id;
  }

  const execution = buildInitialExecution(action, {
    mode: deriveExecutionMode(options.env, action.provider),
    status: mapPendingStatusToExecutionStatus(action.status),
    summary: summarizePendingAction(action),
    metadata: action.metadata ?? "{}",
    createdAt: now,
    approvalRequestId: approvalRequest?.id,
    stepUpRequirementId: stepUpRequirement?.id,
  });

  storePendingAction(options.sessionId, action);
  upsertExecution(options.sessionId, execution);
  return action;
}

export function updatePendingActionForSession(options: {
  sessionId: string;
  pendingAction: PendingDelegatedAction;
  updates: PendingDelegatedActionUpdate;
}): PendingDelegatedAction {
  const nextAction: PendingDelegatedAction = {
    ...options.pendingAction,
    ...options.updates,
    updatedAt: Date.now(),
  };

  return storePendingAction(options.sessionId, nextAction);
}

export async function executePendingActionForSession(options: {
  env: RuntimeEnv;
  session: RuntimeSessionRecord;
  pendingAction: PendingDelegatedAction;
}): Promise<SecureActionExecutionResult> {
  expireApprovalRequestsForSession(options.session.id);

  const pendingAction =
    getPendingActionForSession(options.session.id, options.pendingAction.id)
    ?? options.pendingAction;
  const approvalRequest = pendingAction.approvalRequestId
    ? getApprovalRequestForSession(options.session.id, pendingAction.approvalRequestId)
    : undefined;
  const stepUpRequirement = pendingAction.stepUpRequirementId
    ? getStepUpRequirementForSession(
        options.session.id,
        pendingAction.stepUpRequirementId,
      )
    : undefined;
  const existingExecution = pendingAction.delegatedActionExecutionId
    ? getExecutionForSession(
        options.session.id,
        pendingAction.delegatedActionExecutionId,
      )
    : undefined;

  let execution =
    existingExecution
    ?? buildInitialExecution(pendingAction, {
      mode: deriveExecutionMode(options.env, pendingAction.provider),
      status: mapPendingStatusToExecutionStatus(pendingAction.status),
      summary: summarizePendingAction(pendingAction),
      metadata: pendingAction.metadata ?? "{}",
      createdAt: Date.now(),
      approvalRequestId: approvalRequest?.id,
      stepUpRequirementId: stepUpRequirement?.id,
    });

  if (
    options.env.liveAuthMode
    && options.session.runtimeMode === "live"
    && options.session.status !== "authenticated"
  ) {
    return finalizeBlockedExecution(options.session.id, {
      execution,
      pendingAction,
      approvalRequest,
      stepUpRequirement,
      status: "blocked",
      summary: "Authentication is required before DevPilot can act on your behalf.",
      log: "[SECURE_ACTION] Blocked because the user is not authenticated.",
    });
  }

  if (
    pendingAction.approvalStatus === "pending"
    || pendingAction.status === "awaiting_approval"
  ) {
    return finalizeBlockedExecution(options.session.id, {
      execution,
      pendingAction,
      approvalRequest,
      stepUpRequirement,
      status: "awaiting_approval",
      summary: "This action is waiting for explicit approval.",
      log: "[SECURE_ACTION] Execution paused while waiting for approval.",
    });
  }

  if (pendingAction.approvalStatus === "rejected" || pendingAction.status === "rejected") {
    return finalizeBlockedExecution(options.session.id, {
      execution,
      pendingAction,
      approvalRequest,
      stepUpRequirement,
      status: "rejected",
      summary: "This action was rejected and cannot be executed.",
      log: "[SECURE_ACTION] Blocked because approval was rejected.",
      completedAt: Date.now(),
    });
  }

  if (pendingAction.approvalStatus === "expired" || pendingAction.status === "expired") {
    return finalizeBlockedExecution(options.session.id, {
      execution,
      pendingAction,
      approvalRequest,
      stepUpRequirement,
      status: "expired",
      summary: "This action can no longer run because its approval request expired.",
      log: "[SECURE_ACTION] Blocked because approval expired.",
      completedAt: Date.now(),
    });
  }

  if (pendingAction.approvalStatus === "cancelled" || pendingAction.status === "cancelled") {
    return finalizeBlockedExecution(options.session.id, {
      execution,
      pendingAction,
      approvalRequest,
      stepUpRequirement,
      status: "cancelled",
      summary: "This action was cancelled and will not run.",
      log: "[SECURE_ACTION] Blocked because the approval request was cancelled.",
      completedAt: Date.now(),
    });
  }

  if (
    pendingAction.stepUpStatus === "required"
    || pendingAction.stepUpStatus === "in_progress"
    || pendingAction.status === "awaiting_step_up"
  ) {
    return finalizeBlockedExecution(options.session.id, {
      execution,
      pendingAction,
      approvalRequest,
      stepUpRequirement,
      status: "awaiting_step_up",
      summary: "Step-up authentication is required before this action can run.",
      log: "[SECURE_ACTION] Execution paused while waiting for step-up authentication.",
    });
  }

  if (pendingAction.stepUpStatus === "failed") {
    return finalizeBlockedExecution(options.session.id, {
      execution,
      pendingAction,
      approvalRequest,
      stepUpRequirement,
      status: "blocked",
      summary: "Step-up authentication failed, so the action cannot proceed.",
      log: "[SECURE_ACTION] Blocked because step-up authentication failed.",
      completedAt: Date.now(),
    });
  }

  const executingPendingAction = storePendingAction(options.session.id, {
    ...pendingAction,
    status: "executing",
    updatedAt: Date.now(),
  });
  execution = upsertExecution(options.session.id, {
    ...execution,
    status: "running",
    summary: `Executing ${pendingAction.title} through the secure backend boundary.`,
    logs: [
      ...execution.logs,
      "[SECURE_ACTION] Governance checks passed. Dispatching provider action.",
    ],
    updatedAt: Date.now(),
  });

  try {
    const outcome = await dispatchProviderAction({
      env: options.env,
      session: options.session,
      pendingAction: executingPendingAction,
    });

    const completedExecution: DelegatedActionExecution = {
      ...execution,
      mode: outcome.mode,
      status: outcome.status,
      summary: outcome.summary,
      logs: [...execution.logs, ...outcome.logs],
      externalRef: outcome.externalRef,
      externalUrl: outcome.externalUrl,
      metadata: JSON.stringify(outcome.metadata ?? {}),
      updatedAt: Date.now(),
      completedAt:
        outcome.status === "completed"
        || outcome.status === "failed"
        || outcome.status === "blocked"
          ? Date.now()
          : undefined,
    };

    upsertExecution(options.session.id, completedExecution);

    if (outcome.status === "completed") {
      deletePendingAction(options.session.id, executingPendingAction.id);
      return {
        ok: true,
        execution: completedExecution,
        approvalRequest,
        stepUpRequirement,
        executionMode: outcome.mode === "fallback" ? "dry_run" : "deferred",
        message: outcome.summary,
      };
    }

    const retainedPendingAction = storePendingAction(options.session.id, {
      ...executingPendingAction,
      status: "blocked",
      updatedAt: Date.now(),
    });

    return {
      ok: false,
      pendingAction: retainedPendingAction,
      execution: completedExecution,
      approvalRequest,
      stepUpRequirement,
      executionMode: outcome.status === "blocked" ? "blocked" : "deferred",
      message: outcome.summary,
    };
  } catch (error) {
    const failedExecution: DelegatedActionExecution = {
      ...execution,
      status: "failed",
      summary:
        error instanceof Error
          ? error.message
          : "Delegated action failed unexpectedly.",
      logs: [
        ...execution.logs,
        error instanceof Error ? error.message : String(error),
      ],
      updatedAt: Date.now(),
      completedAt: Date.now(),
    };

    const blockedPendingAction = storePendingAction(options.session.id, {
      ...executingPendingAction,
      status: "blocked",
      updatedAt: Date.now(),
    });

    upsertExecution(options.session.id, failedExecution);
    return {
      ok: false,
      pendingAction: blockedPendingAction,
      execution: failedExecution,
      approvalRequest,
      stepUpRequirement,
      executionMode: "blocked",
      message: failedExecution.summary,
    };
  }
}

export function getRuntimeActionState(sessionId: string): {
  pendingActions: PendingDelegatedAction[];
  executions: DelegatedActionExecution[];
  approvalRequests: ApprovalRequest[];
  stepUpRequirements: StepUpRequirement[];
} {
  expireApprovalRequestsForSession(sessionId);
  return {
    pendingActions: getPendingActionsForSession(sessionId),
    executions: getExecutionsForSession(sessionId),
    approvalRequests: getApprovalRequestsForSession(sessionId),
    stepUpRequirements: getStepUpRequirementsForSession(sessionId),
  };
}

export function approvePendingActionForSession(options: {
  sessionId: string;
  approvalRequestId: string;
}) {
  return approveApprovalRequestForSession(options);
}

export function completePendingActionStepUpForSession(options: {
  sessionId: string;
  stepUpRequirementId: string;
}) {
  return completeStepUpRequirementForSession(options);
}

function buildInitialExecution(
  pendingAction: PendingDelegatedAction,
  args: {
    mode: DelegatedActionExecution["mode"];
    status: DelegatedActionExecutionStatus;
    summary: string;
    metadata: string;
    createdAt: number;
    approvalRequestId?: string;
    stepUpRequirementId?: string;
  },
): DelegatedActionExecution {
  return {
    id: pendingAction.delegatedActionExecutionId ?? `execution:${crypto.randomUUID()}`,
    taskId: pendingAction.taskId,
    provider: pendingAction.provider as DelegatedActionExecution["provider"],
    actionKey: pendingAction.actionKey,
    riskLevel: pendingAction.riskLevel,
    mode: args.mode,
    status: args.status,
    approvalStatus: pendingAction.approvalStatus,
    stepUpStatus: pendingAction.stepUpStatus,
    approvalRequestId: args.approvalRequestId,
    stepUpRequirementId: args.stepUpRequirementId,
    summary: args.summary,
    logs: [
      `[SECURE_ACTION] Proposed ${pendingAction.actionKey} with scopes: ${pendingAction.requiredScopes.join(", ") || "none"}.`,
    ],
    metadata: args.metadata,
    createdAt: args.createdAt,
    updatedAt: args.createdAt,
  };
}

function finalizeBlockedExecution(
  sessionId: string,
  options: {
    execution: DelegatedActionExecution;
    pendingAction: PendingDelegatedAction;
    approvalRequest?: ApprovalRequest;
    stepUpRequirement?: StepUpRequirement;
    status: DelegatedActionExecution["status"];
    summary: string;
    log: string;
    completedAt?: number;
  },
): SecureActionExecutionResult {
  const nextExecution: DelegatedActionExecution = {
    ...options.execution,
    status: options.status,
    summary: options.summary,
    logs: [...options.execution.logs, options.log],
    updatedAt: Date.now(),
    completedAt: options.completedAt,
  };

  upsertExecution(sessionId, nextExecution);
  return {
    ok: false,
    pendingAction: options.pendingAction,
    execution: nextExecution,
    approvalRequest: options.approvalRequest,
    stepUpRequirement: options.stepUpRequirement,
    executionMode: "blocked",
    message: options.summary,
  };
}

async function dispatchProviderAction(options: {
  env: RuntimeEnv;
  session: RuntimeSessionRecord;
  pendingAction: PendingDelegatedAction;
}) {
  const metadata = parseMetadata(options.pendingAction.metadata);
  const context = {
    env: options.env,
    session: options.session,
    metadata,
  };

  switch (options.pendingAction.provider) {
    case "github":
      return githubActionService.executeAction(options.pendingAction.actionKey, context);
    case "gitlab":
      return gitlabActionService.executeAction(options.pendingAction.actionKey, context);
    case "slack":
      return slackActionService.executeAction(options.pendingAction.actionKey, context);
    default:
      throw new Error(
        `Unsupported delegated action provider '${options.pendingAction.provider}'.`,
      );
  }
}

function parseMetadata(metadata: string | undefined): DelegatedActionMetadata {
  if (!metadata) {
    return {};
  }

  try {
    return JSON.parse(metadata) as DelegatedActionMetadata;
  } catch {
    return {};
  }
}

function deriveExecutionMode(
  env: RuntimeEnv,
  provider: PendingDelegatedAction["provider"],
): DelegatedActionExecution["mode"] {
  if (!env.liveDelegatedActionMode) {
    return "fallback";
  }

  if (provider === "github" && env.liveGitHubActionMode) {
    return "live";
  }

  if (provider === "slack" && env.liveSlackActionMode) {
    return "live";
  }

  return "fallback";
}

function mapPendingStatusToExecutionStatus(
  status: PendingDelegatedAction["status"],
): DelegatedActionExecution["status"] {
  switch (status) {
    case "awaiting_approval":
      return "awaiting_approval";
    case "awaiting_step_up":
      return "awaiting_step_up";
    case "approved":
      return "approved";
    case "rejected":
      return "rejected";
    case "expired":
      return "expired";
    case "cancelled":
      return "cancelled";
    case "blocked":
      return "blocked";
    default:
      return "proposed";
  }
}

function summarizePendingAction(action: PendingDelegatedAction): string {
  if (action.status === "awaiting_approval") {
    return `Awaiting approval for ${action.title}.`;
  }

  if (action.status === "awaiting_step_up") {
    return `Awaiting step-up authentication for ${action.title}.`;
  }

  if (action.status === "approved") {
    return `${action.title} is approved and ready to execute.`;
  }

  return `Prepared delegated action: ${action.title}.`;
}
