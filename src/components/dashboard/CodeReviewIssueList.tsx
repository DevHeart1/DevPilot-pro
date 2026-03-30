import React, { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { codeReviewIssueService } from "../../lib/services";
import { CodeReviewIssue, CodeReviewIssueCategory } from "../../types";

type CategoryFilter = "all" | CodeReviewIssueCategory;

const CATEGORY_OPTIONS: Array<{ id: CategoryFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "cleanup", label: "Cleanup" },
  { id: "performance", label: "Performance" },
  { id: "security", label: "Security" },
  { id: "code_health", label: "Code Health" },
  { id: "testing", label: "Testing" },
  { id: "ui", label: "UI / UX" },
];

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(timestamp);
}

function categoryLabel(category: CodeReviewIssueCategory): string {
  switch (category) {
    case "cleanup":
      return "Cleanup";
    case "performance":
      return "Performance";
    case "security":
      return "Security";
    case "code_health":
      return "Code Health";
    case "testing":
      return "Testing";
    case "ui":
      return "UI / UX";
  }
}

function severityClasses(severity: CodeReviewIssue["severity"]): string {
  switch (severity) {
    case "high":
      return "border-rose-500/20 bg-rose-500/10 text-rose-300";
    case "medium":
      return "border-amber-500/20 bg-amber-500/10 text-amber-200";
    case "low":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  }
}

function statusLabel(status: CodeReviewIssue["status"]): string {
  switch (status) {
    case "new":
      return "New";
    case "queued":
      return "Queued";
    case "started":
      return "Started";
    case "dismissed":
      return "Dismissed";
    case "archived":
      return "Archived";
  }
}

interface CodeReviewIssueCardProps {
  issue: CodeReviewIssue;
  onClick: (id: string) => void;
}

const CodeReviewIssueCard: React.FC<CodeReviewIssueCardProps> = ({ issue, onClick }) => {
  return (
    <button
      type="button"
      onClick={() => onClick(issue.id)}
      className="group flex w-full flex-col gap-4 rounded-2xl border border-border-subtle bg-surface/30 p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-surface/50 hover:shadow-[0_20px_80px_rgba(0,0,0,0.2)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            <span>{issue.repoName || issue.repo}</span>
            <span className="text-slate-700">/</span>
            <span>{issue.branch}</span>
          </div>
          <div className="text-lg font-semibold text-slate-50 transition-colors group-hover:text-white">
            {issue.title}
          </div>
          <p className="max-w-3xl text-sm leading-relaxed text-slate-400">
            {issue.summary}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary/90">
            {categoryLabel(issue.category)}
          </span>
          <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${severityClasses(issue.severity)}`}>
            {issue.severity}
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] font-semibold text-slate-300">
            {Math.round(issue.confidence * 100)}% confidence
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {issue.relatedFiles.slice(0, 3).map((file) => (
          <span
            key={file}
            className="rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1 text-[11px] text-slate-400"
          >
            {file}
          </span>
        ))}
        {issue.relatedFiles.length > 3 && (
          <span className="rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1 text-[11px] text-slate-500">
            +{issue.relatedFiles.length - 3} more
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-4 text-xs text-slate-500">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">stars</span>
            Score {issue.score}
          </span>
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">history</span>
            {issue.occurrenceCount} signal{issue.occurrenceCount === 1 ? "" : "s"}
          </span>
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">schedule</span>
            {formatTimeAgo(issue.updatedAt)}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-semibold text-slate-300">
            {statusLabel(issue.status)}
          </span>
          <span className="flex items-center gap-1 font-semibold text-slate-300 transition-colors group-hover:text-primary">
            Start review
            <span className="material-symbols-outlined text-sm">arrow_outward</span>
          </span>
        </div>
      </div>
    </button>
  );
};

interface CodeReviewIssueListProps {
  onSelectIssue: (id: string) => void;
}

export const CodeReviewIssueList: React.FC<CodeReviewIssueListProps> = ({ onSelectIssue }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");
  const issues = useLiveQuery(() => codeReviewIssueService.getVisibleIssues(), []);

  const allIssues = issues || [];
  const filteredIssues = allIssues.filter((issue) => {
    if (activeCategory !== "all" && issue.category !== activeCategory) {
      return false;
    }

    const searchable = [
      issue.title,
      issue.summary,
      issue.repo,
      issue.repoName || "",
      issue.branch,
      issue.relatedFiles.join(" "),
      issue.evidence.join(" "),
    ]
      .join(" ")
      .toLowerCase();

    return searchable.includes(searchQuery.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="relative">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
          search
        </span>
        <input
          type="text"
          placeholder="Search discovered review issues by repo, file, or summary..."
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          className="w-full rounded-xl border border-border-subtle bg-surface/30 py-3 pl-10 pr-4 text-sm text-slate-100 placeholder:text-slate-500 transition-all focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {CATEGORY_OPTIONS.map((category) => {
          const count = allIssues.filter((issue) =>
            category.id === "all" ? true : issue.category === category.id,
          ).length;
          const isActive = activeCategory === category.id;

          return (
            <button
              key={category.id}
              type="button"
              onClick={() => setActiveCategory(category.id)}
              className={[
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                isActive
                  ? "border-primary/25 bg-primary/10 text-primary"
                  : "border-white/8 bg-white/[0.03] text-slate-400 hover:border-white/15 hover:text-slate-200",
              ].join(" ")}
            >
              {category.label} <span className="text-[10px] text-current/70">{count}</span>
            </button>
          );
        })}
      </div>

      {filteredIssues.length > 0 ? (
        <div className="space-y-4">
          {filteredIssues.map((issue) => (
            <CodeReviewIssueCard
              key={issue.id}
              issue={issue}
              onClick={onSelectIssue}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-border-subtle bg-surface/20 px-6 py-12 text-center text-slate-500">
          {searchQuery || activeCategory !== "all"
            ? "No discovered review issues match the current filters."
            : "No proactive review issues have been surfaced yet. Once repository context loads, DevPilot will quietly queue high-signal review work here."}
        </div>
      )}
    </div>
  );
};
