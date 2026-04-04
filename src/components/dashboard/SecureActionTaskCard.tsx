import React, { useMemo, useState } from "react";
import { AuthorizationAuditTimeline } from "../secure-actions/AuthorizationAuditTimeline";
import { AuthorizationInsightList } from "../secure-actions/AuthorizationInsightList";
import {
  ApprovalRequest,
  AuthorizationAuditEvent,
  AuthorizationInsight,
  ConnectedIntegration,
  DelegatedActionExecution,
  PendingDelegatedAction,
  StepUpRequirement,
} from "../../types";

interface SecureActionTaskCardProps {
  pendingActions: PendingDelegatedAction[];
  approvalRequests: ApprovalRequest[];
  stepUpRequirements: StepUpRequirement[];
  executions: DelegatedActionExecution[];
  integrations: ConnectedIntegration[];
  authorizationInsights: AuthorizationInsight[];
  authorizationAuditEvents: AuthorizationAuditEvent[];
  canLaunchDemo: boolean;
  isLaunchingDemo?: boolean;
  onLaunchDemo: () => Promise<void>;
  onApproveApprovalRequest: (id: string) => Promise<void>;
  onRejectApprovalRequest: (id: string) => Promise<void>;
  onStartStepUpRequirement: (id: string) => Promise<void>;
  onCompleteStepUpRequirement: (id: string) => Promise<void>;
  onExecutePendingAction: (id: string) => Promise<void>;
}

export const SecureActionTaskCard: React.FC<SecureActionTaskCardProps> = ({
  pendingActions,
  approvalRequests,
  stepUpRequirements,
  executions,
  integrations,
  authorizationInsights,
  authorizationAuditEvents,
  canLaunchDemo,
  isLaunchingDemo = false,
  onLaunchDemo,
  onApproveApprovalRequest,
  onRejectApprovalRequest,
  onStartStepUpRequirement,
  onCompleteStepUpRequirement,
  onExecutePendingAction,
}) => {
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [activeApprovalId, setActiveApprovalId] = useState<string | null>(null);
  const [activeStepUpId, setActiveStepUpId] = useState<string | null>(null);

  const approvalRequestsById = useMemo(
    () =>
      new Map(
        approvalRequests.map((approvalRequest) => [
          approvalRequest.id,
          approvalRequest,
        ]),
      ),
    [approvalRequests],
  );
  const stepUpRequirementsById = useMemo(
    () =>
      new Map(
        stepUpRequirements.map((stepUpRequirement) => [
          stepUpRequirement.id,
          stepUpRequirement,
        ]),
      ),
    [stepUpRequirements],
  );
  const relevantIntegrations = integrations.filter(
    (integration) =>
      integration.provider === "gitlab" || integration.provider === "slack",
  );
  const latestExecution = executions[0];
  const blockedExecution = executions.find(
    (execution) =>
      execution.status === "blocked" ||
      execution.status === "failed" ||
      execution.status === "rejected" ||
      execution.status === "expired",
  );
  const blockedInsight = authorizationInsights.find(
    (insight) => insight.severity !== "info",
  );

  const runAction = async (
    id: string,
    runner: (actionId: string) => Promise<void>,
    setBusyId: (value: string | null) => void,
  ) => {
    setBusyId(id);
    try {
      await runner(id);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="rounded-2xl border border-border-dark bg-[#101010] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">
            <span className="material-symbols-outlined text-[16px] text-primary">shield_lock</span>
            Secure Handoff
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-slate-400">
            High-risk repo writes pause for approval and step-up, then execute
            through the protected backend boundary instead of browser-held
            provider tokens.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void onLaunchDemo()}
          disabled={!canLaunchDemo || isLaunchingDemo}
          className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-primary transition-colors hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLaunchingDemo ? "Preparing..." : "Launch Demo"}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {relevantIntegrations.map((integration) => (
          <span
            key={integration.id}
            className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
              integration.status === "connected"
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
                : integration.status === "expired"
                  ? "border-amber-500/20 bg-amber-500/10 text-amber-200"
                  : "border-white/[0.08] bg-white/[0.03] text-slate-400"
            }`}
          >
            {integration.displayName} {integration.status.replace(/_/g, " ")}
          </span>
        ))}
      </div>

      {pendingActions.length === 0 && executions.length === 0 ? (
        <div className="mt-4 rounded-xl border border-white/[0.06] bg-black/20 px-4 py-4 text-[12px] leading-relaxed text-slate-500">
          Launch the secure demo after a patch proposal is ready to show the
          approval checkpoint, supervised repo action, team notification, and
          verification follow-up in one clean flow.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {pendingActions.map((action) => {
            const approvalRequest = action.approvalRequestId
              ? approvalRequestsById.get(action.approvalRequestId)
              : undefined;
            const stepUpRequirement = action.stepUpRequirementId
              ? stepUpRequirementsById.get(action.stepUpRequirementId)
              : undefined;
            const metadata = parseJsonRecord(action.metadata);
            const target = describeTarget(metadata);
            const actionInsights = authorizationInsights.filter(
              (insight) =>
                insight.actionKey === action.actionKey ||
                (insight.provider === action.provider && !insight.actionKey),
            );
            const actionAuditEvents = authorizationAuditEvents.filter(
              (event) =>
                event.delegatedActionExecutionId === action.delegatedActionExecutionId ||
                (event.provider === action.provider && event.taskId === action.taskId),
            );

            return (
              <div
                key={action.id}
                className="rounded-xl border border-white/[0.06] bg-black/20 px-4 py-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-white">{action.title}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${riskBadgeClass(action.riskLevel)}`}>
                    {action.riskLevel}
                  </span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${statusBadgeClass(action.status)}`}>
                    {action.status.replace(/_/g, " ")}
                  </span>
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-slate-400">
                  {action.summary}
                </p>
                {target && (
                  <p className="mt-2 text-[11px] text-slate-500">{target}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {action.requiredScopes.map((scope) => (
                    <span
                      key={scope}
                      className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] text-slate-300"
                    >
                      {scope}
                    </span>
                  ))}
                </div>

                {approvalRequest && (
                  <div className="mt-3 rounded-lg border border-amber-500/15 bg-amber-500/5 px-3 py-2 text-[11px] leading-relaxed text-amber-100/85">
                    <div className="font-semibold text-amber-200">Approval required</div>
                    <div>{approvalReason(approvalRequest)}</div>
                  </div>
                )}

                {stepUpRequirement && (
                  <div className="mt-3 rounded-lg border border-sky-500/15 bg-sky-500/5 px-3 py-2 text-[11px] leading-relaxed text-sky-100/85">
                    <div className="font-semibold text-sky-200">Step-up checkpoint</div>
                    <div>{stepUpRequirement.reason}</div>
                  </div>
                )}

                {actionInsights.length > 0 && (
                  <AuthorizationInsightList
                    insights={actionInsights}
                    title="Why this action?"
                    emptyState="No extra security notes for this action."
                    maxItems={2}
                    className="mt-3"
                  />
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {approvalRequest?.status === "pending" && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          void runAction(
                            approvalRequest.id,
                            onApproveApprovalRequest,
                            setActiveApprovalId,
                          )
                        }
                        disabled={activeApprovalId === approvalRequest.id}
                        className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-200 transition-colors hover:bg-emerald-500/15 disabled:opacity-50"
                      >
                        {activeApprovalId === approvalRequest.id ? "Approving..." : "Approve"}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void runAction(
                            approvalRequest.id,
                            onRejectApprovalRequest,
                            setActiveApprovalId,
                          )
                        }
                        disabled={activeApprovalId === approvalRequest.id}
                        className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-[11px] font-semibold text-rose-200 transition-colors hover:bg-rose-500/15 disabled:opacity-50"
                      >
                        {activeApprovalId === approvalRequest.id ? "Working..." : "Reject"}
                      </button>
                    </>
                  )}

                  {stepUpRequirement?.status === "required" && (
                    <button
                      type="button"
                      onClick={() =>
                        void runAction(
                          stepUpRequirement.id,
                          onStartStepUpRequirement,
                          setActiveStepUpId,
                        )
                      }
                      disabled={activeStepUpId === stepUpRequirement.id}
                      className="rounded-lg border border-sky-500/20 bg-sky-500/10 px-3 py-1.5 text-[11px] font-semibold text-sky-100 transition-colors hover:bg-sky-500/15 disabled:opacity-50"
                    >
                      {activeStepUpId === stepUpRequirement.id ? "Starting..." : "Start Step-Up"}
                    </button>
                  )}

                  {stepUpRequirement?.status === "in_progress" && (
                    <button
                      type="button"
                      onClick={() =>
                        void runAction(
                          stepUpRequirement.id,
                          onCompleteStepUpRequirement,
                          setActiveStepUpId,
                        )
                      }
                      disabled={activeStepUpId === stepUpRequirement.id}
                      className="rounded-lg border border-sky-500/20 bg-sky-500/10 px-3 py-1.5 text-[11px] font-semibold text-sky-100 transition-colors hover:bg-sky-500/15 disabled:opacity-50"
                    >
                      {activeStepUpId === stepUpRequirement.id ? "Completing..." : "Complete Step-Up"}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      void runAction(action.id, onExecutePendingAction, setActiveActionId)
                    }
                    disabled={
                      activeActionId === action.id ||
                      action.approvalStatus === "pending" ||
                      action.stepUpStatus === "required" ||
                      action.stepUpStatus === "in_progress"
                    }
                    className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] font-semibold text-slate-200 transition-colors hover:bg-white/[0.06] disabled:opacity-50"
                  >
                    {activeActionId === action.id
                      ? "Executing..."
                      : action.approvalStatus === "pending"
                        ? "Awaiting Approval"
                        : action.stepUpStatus === "required" || action.stepUpStatus === "in_progress"
                          ? "Awaiting Step-Up"
                          : "Execute Secure Action"}
                  </button>
                </div>

                {actionAuditEvents.length > 0 && (
                  <AuthorizationAuditTimeline
                    events={actionAuditEvents}
                    title="Authorization timeline"
                    emptyState="Audit events will appear here after DevPilot evaluates this action."
                    maxItems={4}
                    className="mt-3"
                  />
                )}
              </div>
            );
          })}

          {blockedExecution && (
            <div className="rounded-xl border border-rose-500/15 bg-rose-500/5 px-4 py-3 text-[12px] leading-relaxed text-rose-100/85">
              <div className="font-semibold text-rose-200">Blocked path surfaced cleanly</div>
              <div className="mt-1">{blockedExecution.summary}</div>
              {blockedInsight && (
                <div className="mt-2 text-rose-100/80">{blockedInsight.summary}</div>
              )}
            </div>
          )}

          {latestExecution && (
            <div className="rounded-xl border border-white/[0.06] bg-black/20 px-4 py-3 text-[12px] leading-relaxed text-slate-400">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white">Latest secure result</span>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${statusBadgeClass(latestExecution.status)}`}>
                  {latestExecution.status}
                </span>
                <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                  {latestExecution.mode}
                </span>
              </div>
              <div className="mt-2">{latestExecution.summary}</div>
              {latestExecution.externalUrl && (
                <a
                  href={latestExecution.externalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-primary transition-colors hover:text-primary/80"
                >
                  View provider record
                  <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                </a>
              )}
            </div>
          )}

          {authorizationInsights.length > 0 && (
            <AuthorizationInsightList
              insights={authorizationInsights}
              title="Security notes"
              emptyState="Security notes will appear here as delegated actions are evaluated."
              maxItems={3}
            />
          )}

          {authorizationAuditEvents.length > 0 && (
            <AuthorizationAuditTimeline
              events={authorizationAuditEvents}
              title="Task audit trail"
              emptyState="Authorization checkpoints will appear here once DevPilot evaluates external actions."
              maxItems={6}
            />
          )}
        </div>
      )}
    </div>
  );
};

function parseJsonRecord(value?: string): Record<string, unknown> {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return {};
  }

  return {};
}

function describeTarget(metadata: Record<string, unknown>): string | undefined {
  const repoPath = asString(metadata.repoPath);
  const owner = asString(metadata.owner);
  const repo = asString(metadata.repo);
  const sourceBranch = asString(metadata.sourceBranch);
  const targetBranch = asString(metadata.targetBranch);
  const channelId = asString(metadata.channelId);

  if ((owner && repo) || repoPath) {
    const repoLabel = owner && repo ? `${owner}/${repo}` : repoPath;
    if (sourceBranch && targetBranch) {
      return `Target repo: ${repoLabel} from ${sourceBranch} to ${targetBranch}`;
    }
    return `Target repo: ${repoLabel}`;
  }

  if (channelId) {
    return `Target channel: ${channelId}`;
  }

  return undefined;
}

function approvalReason(approvalRequest: ApprovalRequest): string {
  const metadata = parseJsonRecord(approvalRequest.metadata);
  return typeof metadata.reason === "string"
    ? metadata.reason
    : "Explicit human approval is required before DevPilot can continue.";
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function riskBadgeClass(riskLevel: PendingDelegatedAction["riskLevel"]): string {
  if (riskLevel === "low") {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-200";
  }
  if (riskLevel === "medium") {
    return "border-amber-500/20 bg-amber-500/10 text-amber-200";
  }
  return "border-rose-500/20 bg-rose-500/10 text-rose-200";
}

function statusBadgeClass(
  status: PendingDelegatedAction["status"] | DelegatedActionExecution["status"],
): string {
  if (status === "completed" || status === "approved") {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-200";
  }
  if (
    status === "awaiting_approval" ||
    status === "awaiting_step_up" ||
    status === "running" ||
    status === "executing"
  ) {
    return "border-amber-500/20 bg-amber-500/10 text-amber-200";
  }
  if (
    status === "blocked" ||
    status === "failed" ||
    status === "rejected" ||
    status === "expired" ||
    status === "cancelled"
  ) {
    return "border-rose-500/20 bg-rose-500/10 text-rose-200";
  }
  return "border-white/[0.08] bg-white/[0.03] text-slate-400";
}
