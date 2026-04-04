import {
  ApprovalRequest,
  DelegatedActionExecution,
  PendingDelegatedAction,
  StepUpRequirement,
} from "../src/types";
import {
  RuntimeApprovalRequestRecord,
  LoginStateRecord,
  RuntimeExecutionRecord,
  RuntimePendingActionRecord,
  RuntimeSessionRecord,
  RuntimeStepUpRequirementRecord,
} from "./runtime.types";

const sessionStore = new Map<string, RuntimeSessionRecord>();
const pendingActionStore = new Map<string, RuntimePendingActionRecord>();
const executionStore = new Map<string, RuntimeExecutionRecord>();
const approvalRequestStore = new Map<string, RuntimeApprovalRequestRecord>();
const stepUpRequirementStore = new Map<string, RuntimeStepUpRequirementRecord>();
const loginStateStore = new Map<string, LoginStateRecord>();

export function getSession(sessionId: string): RuntimeSessionRecord | undefined {
  return sessionStore.get(sessionId);
}

export function setSession(session: RuntimeSessionRecord): RuntimeSessionRecord {
  sessionStore.set(session.id, session);
  return session;
}

export function deleteSession(sessionId: string): void {
  sessionStore.delete(sessionId);
  prunePendingActionsForSession(sessionId);
  pruneApprovalRequestsForSession(sessionId);
  pruneStepUpRequirementsForSession(sessionId);
}

export function setLoginState(
  state: string,
  loginState: LoginStateRecord,
): void {
  loginStateStore.set(state, loginState);
}

export function takeLoginState(state: string): LoginStateRecord | undefined {
  const loginState = loginStateStore.get(state);
  if (loginState) {
    loginStateStore.delete(state);
  }
  return loginState;
}

export function storePendingAction(
  sessionId: string,
  action: PendingDelegatedAction,
): PendingDelegatedAction {
  pendingActionStore.set(action.id, { sessionId, action });
  return action;
}

export function getPendingActionForSession(
  sessionId: string,
  pendingActionId: string,
): PendingDelegatedAction | undefined {
  const record = pendingActionStore.get(pendingActionId);
  if (!record || record.sessionId !== sessionId) {
    return undefined;
  }

  return record.action;
}

export function getPendingActionsForSession(
  sessionId: string,
): PendingDelegatedAction[] {
  return Array.from(pendingActionStore.values())
    .filter((record) => record.sessionId === sessionId)
    .map((record) => record.action)
    .sort((left, right) => right.updatedAt - left.updatedAt);
}

export function deletePendingAction(
  sessionId: string,
  pendingActionId: string,
): void {
  const record = pendingActionStore.get(pendingActionId);
  if (record && record.sessionId === sessionId) {
    pendingActionStore.delete(pendingActionId);
  }
}

export function prunePendingActionsForSession(sessionId: string): void {
  for (const [pendingId, record] of pendingActionStore.entries()) {
    if (record.sessionId === sessionId) {
      pendingActionStore.delete(pendingId);
    }
  }
}

export function storeApprovalRequest(
  sessionId: string,
  approvalRequest: ApprovalRequest,
): ApprovalRequest {
  approvalRequestStore.set(approvalRequest.id, { sessionId, approvalRequest });
  return approvalRequest;
}

export function getApprovalRequestForSession(
  sessionId: string,
  approvalRequestId: string,
): ApprovalRequest | undefined {
  const record = approvalRequestStore.get(approvalRequestId);
  if (!record || record.sessionId !== sessionId) {
    return undefined;
  }

  return record.approvalRequest;
}

export function getApprovalRequestsForSession(sessionId: string): ApprovalRequest[] {
  return Array.from(approvalRequestStore.values())
    .filter((record) => record.sessionId === sessionId)
    .map((record) => record.approvalRequest)
    .sort((left, right) => right.requestedAt - left.requestedAt);
}

export function getApprovalRequestByPendingAction(
  sessionId: string,
  pendingActionId: string,
): ApprovalRequest | undefined {
  return getApprovalRequestsForSession(sessionId).find(
    (approvalRequest) => approvalRequest.pendingActionId === pendingActionId,
  );
}

export function pruneApprovalRequestsForSession(sessionId: string): void {
  for (const [approvalId, record] of approvalRequestStore.entries()) {
    if (record.sessionId === sessionId) {
      approvalRequestStore.delete(approvalId);
    }
  }
}

export function upsertExecution(
  sessionId: string,
  execution: DelegatedActionExecution,
): DelegatedActionExecution {
  executionStore.set(execution.id, { sessionId, execution });
  return execution;
}

export function getExecutionForSession(
  sessionId: string,
  executionId: string,
): DelegatedActionExecution | undefined {
  const record = executionStore.get(executionId);
  if (!record || record.sessionId !== sessionId) {
    return undefined;
  }

  return record.execution;
}

export function getExecutionsForSession(
  sessionId: string,
): DelegatedActionExecution[] {
  return Array.from(executionStore.values())
    .filter((record) => record.sessionId === sessionId)
    .map((record) => record.execution)
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, 30);
}

export function storeStepUpRequirement(
  sessionId: string,
  stepUpRequirement: StepUpRequirement,
): StepUpRequirement {
  stepUpRequirementStore.set(stepUpRequirement.id, {
    sessionId,
    stepUpRequirement,
  });
  return stepUpRequirement;
}

export function getStepUpRequirementForSession(
  sessionId: string,
  stepUpRequirementId: string,
): StepUpRequirement | undefined {
  const record = stepUpRequirementStore.get(stepUpRequirementId);
  if (!record || record.sessionId !== sessionId) {
    return undefined;
  }

  return record.stepUpRequirement;
}

export function getStepUpRequirementsForSession(
  sessionId: string,
): StepUpRequirement[] {
  return Array.from(stepUpRequirementStore.values())
    .filter((record) => record.sessionId === sessionId)
    .map((record) => record.stepUpRequirement)
    .sort((left, right) => right.updatedAt - left.updatedAt);
}

export function getStepUpRequirementByPendingAction(
  sessionId: string,
  pendingActionId: string,
): StepUpRequirement | undefined {
  return getStepUpRequirementsForSession(sessionId).find(
    (stepUpRequirement) => stepUpRequirement.pendingActionId === pendingActionId,
  );
}

export function pruneStepUpRequirementsForSession(sessionId: string): void {
  for (const [stepUpId, record] of stepUpRequirementStore.entries()) {
    if (record.sessionId === sessionId) {
      stepUpRequirementStore.delete(stepUpId);
    }
  }
}
