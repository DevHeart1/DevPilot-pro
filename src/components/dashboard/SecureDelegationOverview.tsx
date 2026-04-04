import React from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  LockKeyhole,
  PlugZap,
  ShieldCheck,
} from "lucide-react";
import {
  AuthSessionSnapshot,
  ConnectedIntegration,
  DelegatedActionPolicy,
  PendingDelegatedAction,
} from "../../types";

interface SecureDelegationOverviewProps {
  session?: AuthSessionSnapshot;
  integrations: ConnectedIntegration[];
  policies: DelegatedActionPolicy[];
  pendingActions: PendingDelegatedAction[];
  warnings: string[];
  loading?: boolean;
}

export const SecureDelegationOverview: React.FC<SecureDelegationOverviewProps> = ({
  session,
  integrations,
  policies,
  pendingActions,
  warnings,
  loading = false,
}) => {
  const connectedCount = integrations.filter(
    (integration) => integration.status === "connected",
  ).length;
  const approvalQueue = pendingActions.filter(
    (action) => action.approvalStatus === "pending",
  ).length;
  const highRiskCount = policies.filter(
    (policy) => policy.riskLevel === "high",
  ).length;

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
              DevPilot now routes delegated actions through an explicit secure runtime boundary instead of browser-held provider credentials.
            </p>
          </div>
          <Link
            to="/settings"
            className="inline-flex items-center justify-center rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary transition-colors hover:border-primary/35 hover:bg-primary/15"
          >
            Open Permissions
          </Link>
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
              </div>
              <div className="rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-300">
                Server-side gate
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
