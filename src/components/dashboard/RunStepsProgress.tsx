import React from "react";
import { RunStep } from "../../types";

interface RunStepsProgressProps {
  steps: RunStep[];
}

export const RunStepsProgress: React.FC<RunStepsProgressProps> = ({ steps }) => (
  <div className="rounded-2xl border border-border-subtle bg-surface/20 p-4">
    <div className="mb-4 flex items-center justify-between">
      <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
        Run Progress
      </h3>
      <span className="text-xs text-slate-500">
        {steps.filter((step) => step.status === "completed").length}/{steps.length}
      </span>
    </div>
    <div className="space-y-3">
      {steps.map((step, index) => (
        <div key={step.id} className="flex items-start gap-3">
          <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${statusClass(step.status)}`}>
            {index + 1}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-100">{step.label}</span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                {step.status}
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">{step.detail}</p>
          </div>
        </div>
      ))}
    </div>
  </div>
);

function statusClass(status: RunStep["status"]): string {
  switch (status) {
    case "completed":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-200";
    case "running":
      return "border-primary/20 bg-primary/10 text-primary";
    case "failed":
      return "border-rose-500/20 bg-rose-500/10 text-rose-200";
    default:
      return "border-white/[0.08] bg-white/[0.03] text-slate-400";
  }
}
