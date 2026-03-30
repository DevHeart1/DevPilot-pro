import { db } from "../db";
import {
  CodeReviewBatch,
  CodeReviewIssue,
  CodeReviewIssueCategory,
  CodeReviewIssueStatus,
  RepoDiscoveryMemory,
} from "../../types";

const VISIBLE_STATUSES: CodeReviewIssueStatus[] = ["new", "queued", "started"];
const RECENT_MEMORY_WINDOW_MS = 1000 * 60 * 60 * 24 * 21;
const DEFAULT_DISCOVERY_TTL_MS = 1000 * 60 * 15;

function sortIssues(left: CodeReviewIssue, right: CodeReviewIssue): number {
  if (right.score !== left.score) {
    return right.score - left.score;
  }

  if (right.confidence !== left.confidence) {
    return right.confidence - left.confidence;
  }

  return right.updatedAt - left.updatedAt;
}

function mergeStringLists(...values: string[][]): string[] {
  const unique = new Set<string>();

  values.flat().forEach((entry) => {
    const normalized = entry.trim();
    if (normalized) {
      unique.add(normalized);
    }
  });

  return Array.from(unique);
}

function topRecurringFiles(issues: CodeReviewIssue[]): string[] {
  const counts = new Map<string, number>();

  issues.forEach((issue) => {
    issue.relatedFiles.forEach((file) => {
      counts.set(file, (counts.get(file) || 0) + 1);
    });
  });

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8)
    .map(([file]) => file);
}

export interface UpsertDiscoveredIssuesInput {
  repo: string;
  repoName?: string;
  branch: string;
  defaultBranch?: string;
  gitlabProjectId?: string;
  gitlabProjectWebUrl?: string;
  triggerTaskId?: string;
  discoveryMode: string;
  issues: Array<
    Omit<
      CodeReviewIssue,
      | "id"
      | "status"
      | "linkedTaskId"
      | "occurrenceCount"
      | "lastSeenAt"
      | "createdAt"
      | "updatedAt"
    >
  >;
}

export interface UpsertDiscoveredIssuesResult {
  batchId: string;
  createdCount: number;
  refreshedCount: number;
  totalIssueCount: number;
}

export const codeReviewIssueService = {
  getVisibleIssues: async (): Promise<CodeReviewIssue[]> => {
    return (await db.codeReviewIssues.toArray())
      .filter((issue) => VISIBLE_STATUSES.includes(issue.status))
      .sort(sortIssues);
  },

  getIssueById: async (id: string): Promise<CodeReviewIssue | undefined> => {
    return await db.codeReviewIssues.get(id);
  },

  getIssueByDedupeKey: async (dedupeKey: string): Promise<CodeReviewIssue | undefined> => {
    return await db.codeReviewIssues.where("dedupeKey").equals(dedupeKey).first();
  },

  getLatestBatch: async (
    repo: string,
    branch: string,
    discoveryMode?: string,
  ): Promise<CodeReviewBatch | undefined> => {
    const batches = await db.codeReviewBatches
      .where("[repo+branch]")
      .equals([repo, branch])
      .toArray();

    return batches
      .filter((batch) => !discoveryMode || batch.discoveryMode === discoveryMode)
      .sort((left, right) => right.updatedAt - left.updatedAt)[0];
  },

  shouldSkipDiscovery: async (
    repo: string,
    branch: string,
    discoveryMode: string,
    ttlMs = DEFAULT_DISCOVERY_TTL_MS,
  ): Promise<boolean> => {
    const latestBatch = await codeReviewIssueService.getLatestBatch(repo, branch, discoveryMode);
    return !!latestBatch && Date.now() - latestBatch.updatedAt < ttlMs;
  },

  getRepoDiscoveryMemory: async (repo: string, branch: string): Promise<RepoDiscoveryMemory> => {
    const since = Date.now() - RECENT_MEMORY_WINDOW_MS;
    const issues = (await db.codeReviewIssues
      .where("[repo+branch]")
      .equals([repo, branch])
      .toArray())
      .filter((issue) => issue.updatedAt >= since);

    const recurringCategories: Partial<Record<CodeReviewIssueCategory, number>> = {};
    let startedIssueCount = 0;

    issues.forEach((issue) => {
      recurringCategories[issue.category] = (recurringCategories[issue.category] || 0) + 1;
      if (issue.status === "started") {
        startedIssueCount += 1;
      }
    });

    return {
      repo,
      branch,
      recurringCategories,
      recurringFiles: topRecurringFiles(issues),
      recentIssueCount: issues.length,
      startedIssueCount,
    };
  },

  updateIssueStatus: async (
    issueId: string,
    status: CodeReviewIssueStatus,
  ): Promise<number> => {
    return await db.codeReviewIssues.update(issueId, {
      status,
      updatedAt: Date.now(),
    });
  },

  markIssueStarted: async (
    issueId: string,
    linkedTaskId: string,
  ): Promise<number> => {
    return await db.codeReviewIssues.update(issueId, {
      status: "started",
      linkedTaskId,
      updatedAt: Date.now(),
      lastSeenAt: Date.now(),
    });
  },

  upsertDiscoveredIssues: async (
    input: UpsertDiscoveredIssuesInput,
  ): Promise<UpsertDiscoveredIssuesResult> => {
    const now = Date.now();
    const batchId = crypto.randomUUID();
    let createdCount = 0;
    let refreshedCount = 0;

    await db.transaction("rw", db.codeReviewIssues, db.codeReviewBatches, async () => {
      for (const discoveredIssue of input.issues) {
        const existing = await db.codeReviewIssues
          .where("dedupeKey")
          .equals(discoveredIssue.dedupeKey)
          .first();

        if (existing) {
          const refreshedStatus: CodeReviewIssueStatus =
            existing.status === "dismissed" || existing.status === "archived"
              ? existing.status
              : existing.linkedTaskId
                ? "started"
                : "new";

          await db.codeReviewIssues.update(existing.id, {
            repo: input.repo,
            repoName: input.repoName ?? existing.repoName,
            branch: input.branch,
            defaultBranch: input.defaultBranch ?? existing.defaultBranch,
            gitlabProjectId: input.gitlabProjectId ?? existing.gitlabProjectId,
            gitlabProjectWebUrl:
              input.gitlabProjectWebUrl ?? existing.gitlabProjectWebUrl,
            title: discoveredIssue.title,
            summary: discoveredIssue.summary,
            category: discoveredIssue.category,
            severity: discoveredIssue.severity,
            confidence: discoveredIssue.confidence,
            score: discoveredIssue.score,
            easeOfFix: discoveredIssue.easeOfFix,
            impactBreadth: discoveredIssue.impactBreadth,
            source: discoveredIssue.source,
            status: refreshedStatus,
            relatedFiles: mergeStringLists(
              existing.relatedFiles,
              discoveredIssue.relatedFiles,
            ),
            evidence: mergeStringLists(existing.evidence, discoveredIssue.evidence).slice(0, 8),
            suggestedPrompt: discoveredIssue.suggestedPrompt,
            dedupeKey: discoveredIssue.dedupeKey,
            reviewPackKey: discoveredIssue.reviewPackKey ?? existing.reviewPackKey,
            triggerTaskId: input.triggerTaskId ?? discoveredIssue.triggerTaskId ?? existing.triggerTaskId,
            occurrenceCount: existing.occurrenceCount + 1,
            lastSeenAt: now,
            updatedAt: now,
          });
          refreshedCount += 1;
          continue;
        }

        const issue: CodeReviewIssue = {
          ...discoveredIssue,
          id: crypto.randomUUID(),
          repo: input.repo,
          repoName: input.repoName,
          branch: input.branch,
          defaultBranch: input.defaultBranch,
          gitlabProjectId: input.gitlabProjectId,
          gitlabProjectWebUrl: input.gitlabProjectWebUrl,
          triggerTaskId: input.triggerTaskId ?? discoveredIssue.triggerTaskId,
          status: "new",
          linkedTaskId: undefined,
          occurrenceCount: 1,
          lastSeenAt: now,
          createdAt: now,
          updatedAt: now,
        };

        await db.codeReviewIssues.add(issue);
        createdCount += 1;
      }

      await db.codeReviewBatches.add({
        id: batchId,
        repo: input.repo,
        repoName: input.repoName,
        branch: input.branch,
        defaultBranch: input.defaultBranch,
        gitlabProjectId: input.gitlabProjectId,
        gitlabProjectWebUrl: input.gitlabProjectWebUrl,
        triggerTaskId: input.triggerTaskId,
        discoveryMode: input.discoveryMode,
        issueCount: input.issues.length,
        createdAt: now,
        updatedAt: now,
      });
    });

    return {
      batchId,
      createdCount,
      refreshedCount,
      totalIssueCount: input.issues.length,
    };
  },
};
