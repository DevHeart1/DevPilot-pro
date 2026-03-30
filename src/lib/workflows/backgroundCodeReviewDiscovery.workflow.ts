import { gitlabRepositoryAdapter } from "../adapters/gitlabRepository.adapter";
import { codeReviewDiscoveryService } from "../services/codeReviewDiscovery.service";
import { codeReviewIssueService } from "../services/codeReviewIssue.service";
import { GitLabRepositoryTreeEntry } from "../../types";

const DEFAULT_DISCOVERY_MODE = "repo_context_loaded";
const inFlightDiscoveries = new Set<string>();

export interface BackgroundCodeReviewDiscoveryInput {
  repo: string;
  repoName?: string;
  branch: string;
  defaultBranch?: string;
  gitlabProjectId?: string;
  gitlabProjectWebUrl?: string;
  triggerTaskId?: string;
  discoveryMode?: string;
  treeEntries?: GitLabRepositoryTreeEntry[];
  force?: boolean;
}

export interface BackgroundCodeReviewDiscoveryResult {
  skipped: boolean;
  reason?: string;
  batchId?: string;
  issueCount: number;
  createdCount: number;
  refreshedCount: number;
  sampledFileCount: number;
  treeEntryCount: number;
}

function discoveryKey(input: BackgroundCodeReviewDiscoveryInput, mode: string): string {
  return [
    input.gitlabProjectId || input.repo,
    input.branch,
    mode,
  ].join("::");
}

export async function runBackgroundCodeReviewDiscoveryWorkflow(
  input: BackgroundCodeReviewDiscoveryInput,
): Promise<BackgroundCodeReviewDiscoveryResult> {
  const discoveryMode = input.discoveryMode || DEFAULT_DISCOVERY_MODE;

  if (!input.repo || !input.branch) {
    return {
      skipped: true,
      reason: "missing_repository_context",
      issueCount: 0,
      createdCount: 0,
      refreshedCount: 0,
      sampledFileCount: 0,
      treeEntryCount: 0,
    };
  }

  if (!input.gitlabProjectId) {
    console.warn(
      `[Code Review Discovery] Skipping ${input.repo}@${input.branch}: missing GitLab project ID.`,
    );
    return {
      skipped: true,
      reason: "missing_project_id",
      issueCount: 0,
      createdCount: 0,
      refreshedCount: 0,
      sampledFileCount: 0,
      treeEntryCount: input.treeEntries?.length || 0,
    };
  }

  const key = discoveryKey(input, discoveryMode);
  if (inFlightDiscoveries.has(key)) {
    return {
      skipped: true,
      reason: "in_flight",
      issueCount: 0,
      createdCount: 0,
      refreshedCount: 0,
      sampledFileCount: 0,
      treeEntryCount: input.treeEntries?.length || 0,
    };
  }

  if (!input.force) {
    const shouldSkip = await codeReviewIssueService.shouldSkipDiscovery(
      input.repo,
      input.branch,
      discoveryMode,
    );

    if (shouldSkip) {
      return {
        skipped: true,
        reason: "fresh_batch_exists",
        issueCount: 0,
        createdCount: 0,
        refreshedCount: 0,
        sampledFileCount: 0,
        treeEntryCount: input.treeEntries?.length || 0,
      };
    }
  }

  inFlightDiscoveries.add(key);

  try {
    const treeEntries =
      input.treeEntries ||
      (
        await gitlabRepositoryAdapter.listRepositoryTree(
          input.gitlabProjectId,
          input.branch,
        )
      ).data;

    if (!treeEntries || treeEntries.length === 0) {
      console.warn(
        `[Code Review Discovery] No tree entries found for ${input.repo}@${input.branch}.`,
      );
      return {
        skipped: true,
        reason: "empty_repository_tree",
        issueCount: 0,
        createdCount: 0,
        refreshedCount: 0,
        sampledFileCount: 0,
        treeEntryCount: 0,
      };
    }

    const sampledPaths = codeReviewDiscoveryService.selectFilePathsForDiscovery(treeEntries);
    const fileResults = await Promise.all(
      sampledPaths.map(async (filePath) => ({
        filePath,
        result: await gitlabRepositoryAdapter.getFileContent(
          filePath,
          input.gitlabProjectId,
          input.branch,
        ),
      })),
    );
    const sampledFiles = fileResults
      .filter(
        (
          entry,
        ): entry is typeof entry & {
          result: { success: true; data: NonNullable<typeof entry.result.data> };
        } => entry.result.success && !!entry.result.data,
      )
      .map((entry) => entry.result.data);
    const memory = await codeReviewIssueService.getRepoDiscoveryMemory(
      input.repo,
      input.branch,
    );
    const issues = codeReviewDiscoveryService.discoverIssues({
      repo: input.repo,
      repoName: input.repoName,
      branch: input.branch,
      triggerTaskId: input.triggerTaskId,
      treeEntries,
      fileContents: sampledFiles,
      memory,
    });
    const persisted = await codeReviewIssueService.upsertDiscoveredIssues({
      repo: input.repo,
      repoName: input.repoName,
      branch: input.branch,
      defaultBranch: input.defaultBranch,
      gitlabProjectId: input.gitlabProjectId,
      gitlabProjectWebUrl: input.gitlabProjectWebUrl,
      triggerTaskId: input.triggerTaskId,
      discoveryMode,
      issues,
    });

    console.info(
      `[Code Review Discovery] ${input.repo}@${input.branch} (${discoveryMode}) -> ${persisted.totalIssueCount} issues, ${persisted.createdCount} new, ${persisted.refreshedCount} refreshed.`,
    );

    return {
      skipped: false,
      batchId: persisted.batchId,
      issueCount: persisted.totalIssueCount,
      createdCount: persisted.createdCount,
      refreshedCount: persisted.refreshedCount,
      sampledFileCount: sampledFiles.length,
      treeEntryCount: treeEntries.length,
    };
  } catch (error) {
    console.warn(
      `[Code Review Discovery] Failed for ${input.repo}@${input.branch}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return {
      skipped: true,
      reason: "discovery_failed",
      issueCount: 0,
      createdCount: 0,
      refreshedCount: 0,
      sampledFileCount: 0,
      treeEntryCount: input.treeEntries?.length || 0,
    };
  } finally {
    inFlightDiscoveries.delete(key);
  }
}
