import crypto from "node:crypto";
import {
  ApprovalRequest,
  ApprovalRequestTransitionResult,
  DelegatedActionExecution,
  DelegatedActionPolicy,
  PendingDelegatedAction,
} from "../../src/types";
import {
  getApprovalRequestByPendingAction,
  getApprovalRequestForSession,
  getApprovalRequestsForSession,
  getExecutionForSession,
  getPendingActionForSession,
  getStepUpRequirementByPendingAction,
  storeApprovalRequest,
  storePendingAction,
  upsertExecution,
} from "../runtime.store";
import { RuntimeEnv } from "../runtime.types";

export function createApprovalRequestForPendingAction(options: {
  env: RuntimeEnv;
  sessionId: string;
  pendingAction: PendingDelegatedAction;
  policy: DelegatedActionPolicy;
  delegatedActionExecutionId: string;
  now?: number;
}): ApprovalRequest {
  const existing = getApprovalRequestByPendingAction(
    options.sessionId,
    options.pendingAction.id,
  );
  if (existing) {
    return existing;
  }

  const now = options.now ?? Date.now();
  const timeoutSeconds =
    options.policy.approvalTimeoutSeconds ?? options.env.approvalTimeoutSeconds;

  return storeApprovalRequest(options.sessionId, {
    id: `approval:${crypto.randomUUID()}`,
    taskId: options.pendingAction.taskId,
    pendingActionId: options.pendingAction.id,
    delegatedActionExecutionId: options.delegatedActionExecutionId,
    provider: options.pendingAction.provider,
    actionKey: options.pendingAction.actionKey,
    title: options.pendingAction.title,
    summary: options.pendingAction.summary,
    riskLevel: options.pendingAction.riskLevel,
    requiredScopes: options.pendingAction.requiredScopes,
    approvalChannel: "in_app",
    status: "pending",
    requestedAt: now,
    expiresAt: now + timeoutSeconds * 1000,
    metadata: JSON.stringify({
      reason:
        options.policy.approvalReason
        ?? "This delegated action requires explicit human approval.",
      approvalTrigger: options.policy.approvalTrigger,
      requestedScopes: options.pendingAction.requiredScopes,
      mode: options.env.liveAsyncAuthorizationMode ? "in_app_fallback" : "in_app",
    }),
  });
}

export function approveApprovalRequestForSession(options: {
  sessionId: string;
  approvalRequestId: string;
}): ApprovalRequestTransitionResult {
  const approvalRequest = getRequiredApprovalRequest(
    options.sessionId,
    options.approvalRequestId,
  );

  if (approvalRequest.status !== "pending") {
    throw new Error("Only pending approval requests can be approved.");
  }

  const pendingAction = approvalRequest.pendingActionId
    ? getPendingActionForSession(options.sessionId, approvalRequest.pendingActionId)
    : undefined;
  const stepUpRequirement = approvalRequest.pendingActionId
    ? getStepUpRequirementByPendingAction(
        options.sessionId,
        approvalRequest.pendingActionId,
      )
    : undefined;
  const execution = approvalRequest.delegatedActionExecutionId
    ? getExecutionForSession(options.sessionId, approvalRequest.delegatedActionExecutionId)
    : undefined;
  const now = Date.now();

  const nextApprovalRequest = storeApprovalRequest(options.sessionId, {
    ...approvalRequest,
    status: "approved",
    respondedAt: now,
  });

  const nextPendingAction = pendingAction
    ? storePendingAction(options.sessionId, {
        ...pendingAction,
        approvalStatus: "approved",
        status:
          stepUpRequirement && stepUpRequirement.status !== "completed"
            ? "awaiting_step_up"
            : "approved",
        updatedAt: now,
      })
    : undefined;

  const nextExecution = execution
    ? upsertExecution(
        options.sessionId,
        updateExecution(execution, {
          status:
            stepUpRequirement && stepUpRequirement.status !== "completed"
              ? "awaiting_step_up"
              : "approved",
          approvalStatus: "approved",
          summary:
            stepUpRequirement && stepUpRequirement.status !== "completed"
              ? `Approval granted for ${approvalRequest.title}. Waiting for step-up authentication.`
              : `Approval granted for ${approvalRequest.title}. Ready to execute.`,
          log:
            stepUpRequirement && stepUpRequirement.status !== "completed"
              ? "[APPROVAL] Approved. Waiting for step-up authentication."
              : "[APPROVAL] Approved. Action is ready to execute.",
        }),
      )
    : undefined;

  return {
    approvalRequest: nextApprovalRequest,
    pendingAction: nextPendingAction,
    execution: nextExecution,
    stepUpRequirement,
    message:
      nextPendingAction?.status === "awaiting_step_up"
        ? "Approval granted. Step-up authentication is still required."
        : "Approval granted.",
  };
}

export function rejectApprovalRequestForSession(options: {
  sessionId: string;
  approvalRequestId: string;
}): ApprovalRequestTransitionResult {
  const approvalRequest = getRequiredApprovalRequest(
    options.sessionId,
    options.approvalRequestId,
  );

  if (approvalRequest.status !== "pending") {
    throw new Error("Only pending approval requests can be rejected.");
  }

  const pendingAction = approvalRequest.pendingActionId
    ? getPendingActionForSession(options.sessionId, approvalRequest.pendingActionId)
    : undefined;
  const execution = approvalRequest.delegatedActionExecutionId
    ? getExecutionForSession(options.sessionId, approvalRequest.delegatedActionExecutionId)
    : undefined;
  const now = Date.now();

  const nextApprovalRequest = storeApprovalRequest(options.sessionId, {
    ...approvalRequest,
    status: "rejected",
    respondedAt: now,
  });

  const nextPendingAction = pendingAction
    ? storePendingAction(options.sessionId, {
        ...pendingAction,
        approvalStatus: "rejected",
        status: "rejected",
        updatedAt: now,
      })
    : undefined;

  const nextExecution = execution
    ? upsertExecution(
        options.sessionId,
        updateExecution(execution, {
          status: "rejected",
          approvalStatus: "rejected",
          summary: `Approval rejected for ${approvalRequest.title}.`,
          log: "[APPROVAL] Rejected by the user.",
          completedAt: now,
        }),
      )
    : undefined;

  return {
    approvalRequest: nextApprovalRequest,
    pendingAction: nextPendingAction,
    execution: nextExecution,
    message: "Approval rejected.",
  };
}

export function expireApprovalRequestsForSession(
  sessionId: string,
): ApprovalRequestTransitionResult[] {
  const now = Date.now();
  const results: ApprovalRequestTransitionResult[] = [];

  for (const approvalRequest of getApprovalRequestsForSession(sessionId)) {
    if (
      approvalRequest.status !== "pending"
      || !approvalRequest.expiresAt
      || approvalRequest.expiresAt > now
    ) {
      continue;
    }

    const pendingAction = approvalRequest.pendingActionId
      ? getPendingActionForSession(sessionId, approvalRequest.pendingActionId)
      : undefined;
    const execution = approvalRequest.delegatedActionExecutionId
      ? getExecutionForSession(sessionId, approvalRequest.delegatedActionExecutionId)
      : undefined;

    const nextApprovalRequest = storeApprovalRequest(sessionId, {
      ...approvalRequest,
      status: "expired",
      respondedAt: now,
    });

    const nextPendingAction = pendingAction
      ? storePendingAction(sessionId, {
          ...pendingAction,
          approvalStatus: "expired",
          status: "expired",
          updatedAt: now,
        })
      : undefined;

    const nextExecution = execution
      ? upsertExecution(
          sessionId,
          updateExecution(execution, {
            status: "expired",
            approvalStatus: "expired",
            summary: `Approval request expired for ${approvalRequest.title}.`,
            log: "[APPROVAL] Approval request expired before a decision was made.",
            completedAt: now,
          }),
        )
      : undefined;

    results.push({
      approvalRequest: nextApprovalRequest,
      pendingAction: nextPendingAction,
      execution: nextExecution,
      message: "Approval request expired.",
    });
  }

  return results;
}

function getRequiredApprovalRequest(
  sessionId: string,
  approvalRequestId: string,
): ApprovalRequest {
  const approvalRequest = getApprovalRequestForSession(sessionId, approvalRequestId);
  if (!approvalRequest) {
    throw new Error("Approval request not found.");
  }

  return approvalRequest;
}

function updateExecution(
  execution: DelegatedActionExecution,
  updates: {
    status: DelegatedActionExecution["status"];
    approvalStatus?: DelegatedActionExecution["approvalStatus"];
    stepUpStatus?: DelegatedActionExecution["stepUpStatus"];
    summary: string;
    log: string;
    completedAt?: number;
  },
): DelegatedActionExecution {
  return {
    ...execution,
    status: updates.status,
    approvalStatus: updates.approvalStatus ?? execution.approvalStatus,
    stepUpStatus: updates.stepUpStatus ?? execution.stepUpStatus,
    summary: updates.summary,
    logs: [...execution.logs, updates.log],
    updatedAt: Date.now(),
    completedAt: updates.completedAt,
  };
}
