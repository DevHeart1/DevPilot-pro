import crypto from "node:crypto";
import {
  DelegatedActionExecution,
  DelegatedActionPolicy,
  PendingDelegatedAction,
  StepUpRequirement,
  StepUpRequirementTransitionResult,
} from "../../src/types";
import {
  getExecutionForSession,
  getPendingActionForSession,
  getStepUpRequirementByPendingAction,
  getStepUpRequirementForSession,
  storePendingAction,
  storeStepUpRequirement,
  upsertExecution,
} from "../runtime.store";
import { RuntimeEnv } from "../runtime.types";

export function createStepUpRequirementForPendingAction(options: {
  sessionId: string;
  pendingAction: PendingDelegatedAction;
  policy: DelegatedActionPolicy;
  delegatedActionExecutionId: string;
  now?: number;
}): StepUpRequirement {
  const existing = getStepUpRequirementByPendingAction(
    options.sessionId,
    options.pendingAction.id,
  );
  if (existing) {
    return existing;
  }

  const now = options.now ?? Date.now();

  return storeStepUpRequirement(options.sessionId, {
    id: `stepup:${crypto.randomUUID()}`,
    taskId: options.pendingAction.taskId,
    pendingActionId: options.pendingAction.id,
    delegatedActionExecutionId: options.delegatedActionExecutionId,
    actionKey: options.pendingAction.actionKey,
    provider: options.pendingAction.provider,
    required: true,
    reason:
      options.policy.stepUpReason
      ?? "This action requires stronger user authentication before execution.",
    status: "required",
    createdAt: now,
    updatedAt: now,
  });
}

export function startStepUpRequirementForSession(options: {
  env: RuntimeEnv;
  sessionId: string;
  stepUpRequirementId: string;
}): StepUpRequirementTransitionResult {
  const requirement = getRequiredStepUpRequirement(
    options.sessionId,
    options.stepUpRequirementId,
  );
  const pendingAction = requirement.pendingActionId
    ? getPendingActionForSession(options.sessionId, requirement.pendingActionId)
    : undefined;
  const execution = requirement.delegatedActionExecutionId
    ? getExecutionForSession(options.sessionId, requirement.delegatedActionExecutionId)
    : undefined;
  const now = Date.now();

  const nextRequirement = storeStepUpRequirement(options.sessionId, {
    ...requirement,
    status: "in_progress",
    updatedAt: now,
  });

  const nextPendingAction = pendingAction
    ? storePendingAction(options.sessionId, {
        ...pendingAction,
        stepUpStatus: "in_progress",
        status: "awaiting_step_up",
        updatedAt: now,
      })
    : undefined;

  const nextExecution = execution
    ? upsertExecution(
        options.sessionId,
        updateExecution(execution, {
          status: "awaiting_step_up",
          stepUpStatus: "in_progress",
          summary: options.env.liveStepUpMode
            ? `Step-up started for ${requirement.actionKey}. Waiting for stronger user authentication.`
            : `Step-up started for ${requirement.actionKey}. Local fallback confirmation can complete it.`,
          log: options.env.liveStepUpMode
            ? "[STEP_UP] Step-up flow started in live-placeholder mode."
            : "[STEP_UP] Step-up flow started in local fallback mode.",
        }),
      )
    : undefined;

  return {
    stepUpRequirement: nextRequirement,
    pendingAction: nextPendingAction,
    execution: nextExecution,
    message: options.env.liveStepUpMode
      ? "Step-up started."
      : "Step-up started in fallback mode.",
  };
}

export function completeStepUpRequirementForSession(options: {
  sessionId: string;
  stepUpRequirementId: string;
}): StepUpRequirementTransitionResult {
  const requirement = getRequiredStepUpRequirement(
    options.sessionId,
    options.stepUpRequirementId,
  );
  const pendingAction = requirement.pendingActionId
    ? getPendingActionForSession(options.sessionId, requirement.pendingActionId)
    : undefined;
  const execution = requirement.delegatedActionExecutionId
    ? getExecutionForSession(options.sessionId, requirement.delegatedActionExecutionId)
    : undefined;
  const now = Date.now();

  const nextRequirement = storeStepUpRequirement(options.sessionId, {
    ...requirement,
    status: "completed",
    updatedAt: now,
  });

  const nextPendingAction = pendingAction
    ? storePendingAction(options.sessionId, {
        ...pendingAction,
        stepUpStatus: "completed",
        status:
          pendingAction.approvalStatus === "approved"
          || pendingAction.approvalStatus === "not_required"
            ? "approved"
            : "awaiting_approval",
        updatedAt: now,
      })
    : undefined;

  const nextExecution = execution
    ? upsertExecution(
        options.sessionId,
        updateExecution(execution, {
          status:
            pendingAction?.approvalStatus === "approved"
            || pendingAction?.approvalStatus === "not_required"
              ? "approved"
              : "awaiting_approval",
          stepUpStatus: "completed",
          summary:
            pendingAction?.approvalStatus === "approved"
            || pendingAction?.approvalStatus === "not_required"
              ? `Step-up completed for ${requirement.actionKey}. Action is ready to execute.`
              : `Step-up completed for ${requirement.actionKey}. Approval is still required.`,
          log: "[STEP_UP] Step-up completed.",
        }),
      )
    : undefined;

  return {
    stepUpRequirement: nextRequirement,
    pendingAction: nextPendingAction,
    execution: nextExecution,
    message:
      nextPendingAction?.status === "approved"
        ? "Step-up completed. Action is ready to execute."
        : "Step-up completed. Approval is still required.",
  };
}

function getRequiredStepUpRequirement(
  sessionId: string,
  stepUpRequirementId: string,
): StepUpRequirement {
  const requirement = getStepUpRequirementForSession(sessionId, stepUpRequirementId);
  if (!requirement) {
    throw new Error("Step-up requirement not found.");
  }

  return requirement;
}

function updateExecution(
  execution: DelegatedActionExecution,
  updates: {
    status: DelegatedActionExecution["status"];
    stepUpStatus: DelegatedActionExecution["stepUpStatus"];
    summary: string;
    log: string;
  },
): DelegatedActionExecution {
  return {
    ...execution,
    status: updates.status,
    stepUpStatus: updates.stepUpStatus,
    summary: updates.summary,
    logs: [...execution.logs, updates.log],
    updatedAt: Date.now(),
  };
}
