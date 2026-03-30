export type CodeReviewIssueCategory =
  | "ui"
  | "security"
  | "performance"
  | "code_health"
  | "testing"
  | "cleanup";

export type CodeReviewIssueSeverity = "low" | "medium" | "high";

export type CodeReviewIssueSource =
  | "background_discovery"
  | "manual_scan"
  | "repo_analysis";

export type CodeReviewIssueStatus =
  | "new"
  | "queued"
  | "started"
  | "dismissed"
  | "archived";

export interface CodeReviewIssue {
  id: string;
  repo: string;
  repoName?: string;
  branch: string;
  defaultBranch?: string;
  gitlabProjectId?: string;
  gitlabProjectWebUrl?: string;
  title: string;
  summary: string;
  category: CodeReviewIssueCategory;
  severity: CodeReviewIssueSeverity;
  confidence: number;
  score: number;
  easeOfFix: number;
  impactBreadth: number;
  source: CodeReviewIssueSource;
  status: CodeReviewIssueStatus;
  relatedFiles: string[];
  evidence: string[];
  suggestedPrompt: string;
  dedupeKey: string;
  reviewPackKey?: string;
  linkedTaskId?: string;
  triggerTaskId?: string;
  occurrenceCount: number;
  lastSeenAt: number;
  createdAt: number;
  updatedAt: number;
}

export interface CodeReviewBatch {
  id: string;
  repo: string;
  repoName?: string;
  branch: string;
  defaultBranch?: string;
  gitlabProjectId?: string;
  gitlabProjectWebUrl?: string;
  triggerTaskId?: string;
  discoveryMode: string;
  issueCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface RepoDiscoveryMemory {
  repo: string;
  branch: string;
  recurringCategories: Partial<Record<CodeReviewIssueCategory, number>>;
  recurringFiles: string[];
  recentIssueCount: number;
  startedIssueCount: number;
}
