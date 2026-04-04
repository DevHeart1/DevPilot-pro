import React from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  LockKeyhole,
  PlugZap,
  ShieldCheck,
} from "lucide-react";
import { DemoReadinessReport } from "../../lib/services/demoReadiness.service";
import {
  ApprovalRequest,
  AuthSessionSnapshot,
  AuthorizationInsight,
  AuthorizationPatternSummary,
  ConnectedIntegration,
  DelegatedActionPolicy,
  PendingDelegatedAction,
  StepUpRequirement,
} from "../../types";

interface SecureDelegationOverviewProps {
  session?: AuthSessionSnapshot;
  integrations: ConnectedIntegration[];
  policies: DelegatedActionPolicy[];
  pendingActions: PendingDelegatedAction[];
  approvalRequests: ApprovalRequest[];
  stepUpRequirements: StepUpRequirement[];
  authorizationInsights: AuthorizationInsight[];
  authorizationPatternSummary: AuthorizationPatternSummary;
  warnings: string[];
  loading?: boolean;
  demoReadiness?: DemoReadinessReport;
  onLaunchDemo?: () => Promise<void>;
  isLaunchingDemo?: boolean;
}

export const SecureDelegationOverview: React.FC<SecureDelegationOverviewProps> = ({
  session,
  integrations,
  policies,
  pendingActions,
  approvalRequests,
  stepUpRequirements,
  authorizationInsights,
  authorizationPatternSummary,
  warnings,
  loading = false,
  demoReadiness,
  onLaunchDemo,
  isLaunchingDemo = false,
}) => {
  const connectedCount = integrations.filter(
    (integration) => integration.status === "connected",
  ).length;
  const approvalQueue = approvalRequests.filter(
    (request) => request.status === "pending",
  ).length;
  const stepUpQueue = stepUpRequirements.filter(
    (requirement) => requirement.status === "required" || requirement.status === "in_progress",
  ).length;
  const highRiskCount = policies.filter(
    (policy) => policy.riskLevel === "high",
  ).length;
  const primaryInsight = authorizationInsights.find(
    (insight) => insight.severity === "important",
  ) ?? authorizationInsights[0];

  return (
    <section className="mt-8">
      <div className="rounded-[28px] border border-white/[0.08] bg-surface-elevated/80 p-4 backdrop-blur-xl sm:p-5">
        <div className="flex flex-col gap-3 border-b border-white/5 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              Secure Delegation
            </div>
            <p className="mt-2 text-sm text-slate-300">
              DevPilot acts like a supervised AI developer teammate: scoped access, explicit approval for risky writes, and provider execution behind the secure backend boundary.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {demoReadiness && onLaunchDemo && (
              <button
                type="button"
                onClick={() => void onLaunchDemo()}
                disabled={!demoReadiness.canLaunchDemo || isLaunchingDemo}
                className="inline-flex items-center justify-center rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary transition-colors hover:border-primary/35 hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLaunchingDemo
                  ? "Preparing Demo"
                  : demoReadiness.status === "ready"
                    ? "Load Golden Demo"
                    : demoReadiness.status === "fallback"
                      ? "Load Fallback Demo"
                      : "Load Blocked Demo"}
              </button>
            )}
            <Link
              to="/settings"
              className="inline-flex items-center justify-center rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary transition-colors hover:border-primary/35 hover:bg-primary/15"
            >
              Open Permissions
            </Link>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <article className="rounded-2xl border border-white/[0.06] bg-black/[0.18] p-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              <LockKeyhole className="h-3.5 w-3.5 text-primary" />
              Session Boundary
            </div>
            <div className="mt-4 flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold text-white">
                  {loading
                    ? "Syncing secure runtime"
                    : session?.status === "authenticated"
                      ? session.user?.name ?? "Authenticated session"
                      : "Sign-in required"}
                </div>
                <p className="mt-1 text-sm leading-relaxed text-slate-400">
                  {session?.message ?? "Waiting for secure runtime session data."}
                </p>
              </div>
              <StatusDot tone={session?.auth0.tokenVaultReady ? "good" : session?.isFallback ? "warn" : "neutral"} />
            </div>
          </article>

          <article className="rounded-2xl border border-white/[0.06] bg-black/[0.18] p-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              <PlugZap className="h-3.5 w-3.5 text-primary" />
              Connected Tools
            </div>
            <div className="mt-4 flex items-end justify-between gap-3">
              <div>
                <div className="text-2xl font-semibold text-white">{connectedCount}</div>
                <p className="mt-1 text-sm text-slate-400">
                  Providers currently ready for scoped delegated use.
                </p>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                {integrations.map((integration) => (
                  <span
                    key={integration.id}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                      integration.status === "connected"
                        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                        : integration.status === "expired"
                          ? "border-amber-500/20 bg-amber-500/10 text-amber-300"
                          : "border-white/[0.08] bg-white/[0.03] text-slate-400"
                    }`}
                  >
                    {integration.displayName}
                  </span>
                ))}
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-white/[0.06] bg-black/[0.18] p-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              <AlertTriangle className="h-3.5 w-3.5 text-primary" />
              Approval Boundary
            </div>
            <div className="mt-4 flex items-end justify-between gap-3">
              <div>
                <div className="text-2xl font-semibold text-white">{approvalQueue}</div>
                <p className="mt-1 text-sm text-slate-400">
                  Pending approvals across {highRiskCount} high-risk delegated actions.
                </p>
                {pendingActions.length > 0 && (
                  <p className="mt-1 text-[11px] text-slate-500">
                    {pendingActions.length} delegated action{pendingActions.length === 1 ? "" : "s"} currently staged.
                  </p>
                )}
              </div>
              <div className="space-y-2 text-right">
                <div className="rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-300">
                  Server-side gate
                </div>
                {stepUpQueue > 0 && (
                  <div className="text-[11px] font-medium text-amber-300">
                    {stepUpQueue} step-up checkpoint{stepUpQueue === 1 ? "" : "s"}
                  </div>
                )}
              </div>
            </div>
          </article>
        </div>

        {warnings.length > 0 && (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-500/15 bg-amber-500/5 px-4 py-3 text-sm text-amber-100/90">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <span>{warnings[0]}</span>
          </div>
        )}

        {(demoReadiness || primaryInsight || authorizationPatternSummary.generatedAt > 0) && (
          <div className="mt-4 grid gap-3 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-2xl border border-white/[0.06] bg-black/[0.18] px-4 py-3">
              {demoReadiness ? (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                      Judge Demo
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${demoStatusClass(demoReadiness.status)}`}>
                      {demoReadiness.status}
                    </span>
                  </div>
                  <div className="mt-2 text-sm font-semibold text-white">
                    {demoReadiness.headline}
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-slate-400">
                    {demoReadiness.summary}
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {demoReadiness.checks.slice(0, 4).map((check) => (
                      <div
                        key={check.id}
                        className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                            {check.label}
                          </span>
                          <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] ${demoStatusClass(check.status)}`}>
                            {check.status}
                          </span>
                        </div>
                        <p className="mt-1 text-[12px] leading-relaxed text-slate-400">
                          {check.summary}
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Why Actions Pause
                  </div>
                  <div className="mt-2 text-sm font-semibold text-white">
                    {primaryInsight?.title ?? "Secure runtime summary"}
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-slate-400">
                    {primaryInsight?.summary
                      ?? "Delegated actions stay inside explicit policy, approval, and step-up boundaries."}
                  </p>
                </>
              )}
            </div>

            <div className="rounded-2xl border border-white/[0.06] bg-black/[0.18] px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Authorization Snapshot
              </div>
              {primaryInsight && (
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
                  {primaryInsight.summary}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <PatternPill
                  label="Auto-allowed"
                  value={String(authorizationPatternSummary.autoAllowedCount)}
                />
                <PatternPill
                  label="Fallback"
                  value={String(authorizationPatternSummary.fallbackCount)}
                />
                <PatternPill
                  label="Blocked"
                  value={String(authorizationPatternSummary.blockedCount)}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

const StatusDot = ({ tone }: { tone: "good" | "warn" | "neutral" }) => {
  const toneClass =
    tone === "good"
      ? "bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.5)]"
      : tone === "warn"
        ? "bg-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.45)]"
        : "bg-slate-500";

  return <span className={`mt-1 inline-flex h-2.5 w-2.5 rounded-full ${toneClass}`} />;
};

const PatternPill = ({ label, value }: { label: string; value: string }) => (
  <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] text-slate-300">
    <span className="text-slate-500">{label}</span>
    <span className="ml-2 font-semibold text-white">{value}</span>
  </span>
);

function demoStatusClass(status: "ready" | "fallback" | "blocked"): string {
  if (status === "ready") {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  }

  if (status === "fallback") {
    return "border-amber-500/20 bg-amber-500/10 text-amber-300";
  }

  return "border-rose-500/20 bg-rose-500/10 text-rose-300";
}
