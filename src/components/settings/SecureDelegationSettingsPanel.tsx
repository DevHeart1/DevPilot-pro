import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { SecureRuntimeState } from "../../hooks/useTaskHub";
import {
  DelegatedActionPreviewInput,
  DelegatedActionPolicy,
  PendingDelegatedAction,
  SecureActionExecutionResult,
} from "../../types";

const previewTemplates: DelegatedActionPreviewInput[] = [
  {
    provider: "gitlab",
    actionKey: "gitlab.read_repo_metadata",
    title: "Preview repo metadata read",
    summary:
      "Low-risk read path for repository metadata before DevPilot plans code work.",
  },
  {
    provider: "slack",
    actionKey: "slack.post_status_message",
    title: "Preview Slack status update",
    summary:
      "Medium-risk communication action for a narrow engineering status message.",
  },
  {
    provider: "gitlab",
    actionKey: "gitlab.open_draft_pr",
    title: "Preview draft merge request",
    summary:
      "High-risk repository write that should require approval and future step-up auth.",
  },
];

interface SecureDelegationSettingsPanelProps {
  secureRuntimeState: SecureRuntimeState;
  onRefreshSecureRuntime: () => Promise<void>;
  onPreviewDelegatedAction: (
    input: DelegatedActionPreviewInput,
  ) => Promise<PendingDelegatedAction | null>;
  onApprovePendingAction: (
    id: string,
  ) => Promise<PendingDelegatedAction | null>;
  onRejectPendingAction: (
    id: string,
  ) => Promise<PendingDelegatedAction | null>;
  onExecutePendingAction: (
    id: string,
  ) => Promise<SecureActionExecutionResult | null>;
  onLogin: (returnTo?: string) => void;
  onLogout: (returnTo?: string) => void;
}

export const SecureDelegationSettingsPanel: React.FC<
  SecureDelegationSettingsPanelProps
> = ({
  secureRuntimeState,
  onRefreshSecureRuntime,
  onPreviewDelegatedAction,
  onApprovePendingAction,
  onRejectPendingAction,
  onExecutePendingAction,
  onLogin,
  onLogout,
}) => {
  const [isRefreshingRuntime, setIsRefreshingRuntime] = useState(false);
  const [executingActionId, setExecutingActionId] = useState<string | null>(null);

  const policiesByRisk = useMemo(
    () => ({
      low: secureRuntimeState.policies.filter((policy) => policy.riskLevel === "low"),
      medium: secureRuntimeState.policies.filter(
        (policy) => policy.riskLevel === "medium",
      ),
      high: secureRuntimeState.policies.filter((policy) => policy.riskLevel === "high"),
    }),
    [secureRuntimeState.policies],
  );

  const connectedCount = secureRuntimeState.integrations.filter(
    (integration) => integration.status === "connected",
  ).length;
  const pendingApprovalCount = secureRuntimeState.pendingActions.filter(
    (action) => action.approvalStatus === "pending",
  ).length;

  const refreshRuntime = async () => {
    setIsRefreshingRuntime(true);
    try {
      await onRefreshSecureRuntime();
    } finally {
      setIsRefreshingRuntime(false);
    }
  };

  const executeAction = async (id: string) => {
    setExecutingActionId(id);
    try {
      await onExecutePendingAction(id);
    } finally {
      setExecutingActionId(null);
    }
  };

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-white">Secure Delegation Runtime</h3>
            <p className="text-sm text-slate-400 mt-1">
              Auth0-backed session awareness, explicit provider boundaries, and server-side delegated-action gating.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refreshRuntime()}
            className="inline-flex items-center gap-2 rounded-lg border border-border-subtle bg-surface-dark px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-white/5"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshingRuntime ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        <div className="rounded-2xl border border-border-subtle bg-surface/30 p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
                <LockKeyhole className="h-3.5 w-3.5" />
                {secureRuntimeState.session?.runtimeMode === "live"
                  ? "Auth0 Secure Runtime"
                  : "Local Fallback Runtime"}
              </div>
              <div>
                <div className="text-lg font-semibold text-white">
                  {secureRuntimeState.session?.status === "authenticated"
                    ? secureRuntimeState.session.user?.name ?? "Authenticated session"
                    : "Authentication required"}
                </div>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
                  {secureRuntimeState.session?.message
                    ?? "Waiting for secure runtime status."}
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-slate-400">
                <MetaChip label="Connected tools" value={String(connectedCount)} />
                <MetaChip
                  label="Pending approvals"
                  value={String(pendingApprovalCount)}
                />
                <MetaChip
                  label="Token Vault ready"
                  value={secureRuntimeState.session?.auth0.tokenVaultReady ? "Yes" : "No"}
                />
              </div>
            </div>

            <div className="flex min-w-[220px] flex-col gap-3">
              {secureRuntimeState.session?.status === "authenticated"
              && secureRuntimeState.session.runtimeMode === "live" ? (
                <button
                  type="button"
                  onClick={() => onLogout("/settings")}
                  className="rounded-lg border border-border-subtle bg-surface-dark px-4 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:bg-white/5"
                >
                  Sign Out
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onLogin("/settings")}
                  className="rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-background-dark transition-colors hover:bg-primary/90"
                >
                  Sign In With Auth0
                </button>
              )}
              <div className="rounded-xl border border-white/[0.06] bg-black/20 px-4 py-3 text-xs leading-relaxed text-slate-400">
                Frontend views this state, but raw third-party tokens stay behind the secure runtime.
              </div>
            </div>
          </div>

          {secureRuntimeState.warnings.length > 0 && (
            <div className="mt-6 space-y-3">
              {secureRuntimeState.warnings.map((warning) => (
                <div
                  key={warning}
                  className="flex items-start gap-3 rounded-xl border border-amber-500/15 bg-amber-500/5 px-4 py-3 text-sm text-amber-100/90"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                  <span>{warning}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section>
        <h3 className="text-xl font-bold text-white mb-1">Connected Accounts</h3>
        <p className="text-sm text-slate-400 mb-6">
          Provider visibility is explicit: connection status, relevant scopes, and whether DevPilot is reading from Auth0 Token Vault-aware state or local fallback data.
        </p>

        <div className="space-y-4">
          {secureRuntimeState.integrations.map((integration) => (
            <div
              key={integration.id}
              className="rounded-2xl border border-border-subtle bg-surface/30 p-5"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h4 className="text-sm font-semibold text-white">
                      {integration.displayName}
                    </h4>
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${statusBadgeClass(integration.status)}`}>
                      {integration.status.replace(/_/g, " ")}
                    </span>
                    <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      {integration.source === "auth0_token_vault"
                        ? "Auth0 Token Vault"
                        : "Mock Fallback"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">
                    {integration.accountIdentifier
                      ? `Connected as ${integration.accountIdentifier}`
                      : "No provider account is attached yet for delegated actions."}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    {integration.connectedAt
                      ? `Connected ${formatTimestamp(integration.connectedAt)}`
                      : "Waiting for provider connection or Token Vault attachment."}
                  </p>
                </div>

                <div className="rounded-xl border border-white/[0.06] bg-black/20 px-4 py-3 text-right text-xs text-slate-400">
                  Updated {formatTimestamp(integration.updatedAt)}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {integration.scopes.map((scope) => (
                  <span
                    key={scope}
                    className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] text-slate-300 font-mono"
                  >
                    {scope}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h3 className="text-xl font-bold text-white">Permission Boundaries</h3>
        </div>
        <p className="text-sm text-slate-400 mb-6">
          Low-risk reads, medium-risk drafting, and high-risk execution paths are modeled separately so future approvals and step-up authentication fit naturally.
        </p>

        <div className="grid gap-4 lg:grid-cols-3">
          <RiskPolicyCard title="Low Risk" tone="low" policies={policiesByRisk.low} />
          <RiskPolicyCard
            title="Medium Risk"
            tone="medium"
            policies={policiesByRisk.medium}
          />
          <RiskPolicyCard title="High Risk" tone="high" policies={policiesByRisk.high} />
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-1">
          <Workflow className="h-5 w-5 text-primary" />
          <h3 className="text-xl font-bold text-white">Delegated Action Preview Queue</h3>
        </div>
        <p className="text-sm text-slate-400 mb-6">
          Preview scaffolding already exists for future GitLab, GitHub, and Slack actions, with reusable approval and step-up status modeled before provider execution is enabled.
        </p>

        <div className="rounded-2xl border border-border-subtle bg-surface/30 p-5">
          <div className="flex flex-wrap gap-3">
            {previewTemplates.map((template) => (
              <button
                key={template.actionKey}
                type="button"
                onClick={() => void onPreviewDelegatedAction(template)}
                className="inline-flex items-center gap-2 rounded-xl border border-primary/15 bg-primary/10 px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:border-primary/30 hover:bg-primary/15"
              >
                {template.title}
                <ArrowUpRight className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 space-y-4">
          {secureRuntimeState.pendingActions.map((action) => (
            <div
              key={action.id}
              className="rounded-2xl border border-border-subtle bg-surface/30 p-5"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h4 className="text-sm font-semibold text-white">{action.title}</h4>
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${riskBadgeClass(action.riskLevel)}`}>
                      {action.riskLevel} risk
                    </span>
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${approvalBadgeClass(action.approvalStatus)}`}>
                      {action.approvalStatus.replace(/_/g, " ")}
                    </span>
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${stepUpBadgeClass(action.stepUpStatus)}`}>
                      {action.stepUpStatus.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">
                    {action.summary}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    {action.provider.toUpperCase()} · {action.actionKey}
                    {action.taskId ? ` · Task ${action.taskId}` : ""}
                  </p>
                </div>

                <div className="text-xs text-slate-500">
                  Updated {formatTimestamp(action.updatedAt)}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {action.requiredScopes.map((scope) => (
                  <span
                    key={scope}
                    className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] text-slate-300 font-mono"
                  >
                    {scope}
                  </span>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                {action.approvalStatus === "pending" && (
                  <>
                    <button
                      type="button"
                      onClick={() => void onApprovePendingAction(action.id)}
                      className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-200 transition-colors hover:bg-emerald-500/15"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => void onRejectPendingAction(action.id)}
                      className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-200 transition-colors hover:bg-rose-500/15"
                    >
                      Reject
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => void executeAction(action.id)}
                  disabled={executingActionId === action.id}
                  className="rounded-lg border border-border-subtle bg-surface-dark px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {executingActionId === action.id ? "Validating..." : "Validate Secure Execution"}
                </button>
              </div>
            </div>
          ))}

          {secureRuntimeState.pendingActions.length === 0 && (
            <div className="rounded-2xl border border-border-subtle bg-surface/20 px-6 py-10 text-center text-slate-500">
              No delegated action previews yet. Generate one above to inspect its risk, scopes, approval state, and future step-up boundary.
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

const MetaChip = ({ label, value }: { label: string; value: string }) => (
  <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5">
    <span className="text-slate-500">{label}</span>
    <span className="ml-2 text-slate-200 font-semibold">{value}</span>
  </span>
);

const RiskPolicyCard = ({
  title,
  tone,
  policies,
}: {
  title: string;
  tone: "low" | "medium" | "high";
  policies: DelegatedActionPolicy[];
}) => (
  <div className={`rounded-2xl border p-5 ${riskContainerClass(tone)}`}>
    <div className="flex items-center justify-between">
      <h4 className="text-sm font-semibold text-white">{title}</h4>
      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${riskBadgeClass(tone)}`}>
        {policies.length} actions
      </span>
    </div>
    <div className="mt-4 space-y-4">
      {policies.map((policy) => (
        <div key={policy.id}>
          <p className="text-sm font-medium text-slate-100">{policy.summary}</p>
          <p className="mt-1 text-xs text-slate-500">
            {policy.requiresApproval ? "Requires approval" : "No approval"} · {policy.requiresStepUp ? "Step-up expected" : "No step-up"}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {policy.allowedScopes.map((scope) => (
              <span
                key={scope}
                className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] text-slate-300 font-mono"
              >
                {scope}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

function riskContainerClass(tone: "low" | "medium" | "high"): string {
  if (tone === "low") {
    return "border-emerald-500/15 bg-emerald-500/5";
  }
  if (tone === "medium") {
    return "border-amber-500/15 bg-amber-500/5";
  }
  return "border-rose-500/15 bg-rose-500/5";
}

function riskBadgeClass(riskLevel: "low" | "medium" | "high"): string {
  if (riskLevel === "low") {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-200";
  }
  if (riskLevel === "medium") {
    return "border-amber-500/20 bg-amber-500/10 text-amber-200";
  }
  return "border-rose-500/20 bg-rose-500/10 text-rose-200";
}

function approvalBadgeClass(status: PendingDelegatedAction["approvalStatus"]): string {
  if (status === "approved" || status === "not_required") {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-200";
  }
  if (status === "rejected") {
    return "border-rose-500/20 bg-rose-500/10 text-rose-200";
  }
  return "border-amber-500/20 bg-amber-500/10 text-amber-200";
}

function stepUpBadgeClass(status: PendingDelegatedAction["stepUpStatus"]): string {
  if (status === "completed" || status === "not_required") {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-200";
  }
  return "border-primary/20 bg-primary/10 text-primary";
}

function statusBadgeClass(
  status: "connected" | "not_connected" | "expired" | "error",
): string {
  if (status === "connected") {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-200";
  }
  if (status === "expired") {
    return "border-amber-500/20 bg-amber-500/10 text-amber-200";
  }
  if (status === "error") {
    return "border-rose-500/20 bg-rose-500/10 text-rose-200";
  }
  return "border-white/[0.08] bg-white/[0.03] text-slate-400";
}

function formatTimestamp(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(timestamp);
}
