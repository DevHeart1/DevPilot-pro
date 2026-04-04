import { gitlabDuoAdapter } from "../adapters/gitlabDuo.adapter";
import { gitlabRepositoryAdapter } from "../adapters/gitlabRepository.adapter";
import { config } from "../config/env";
import {
  gitlabRepositoryService,
  patchProposalService,
  pendingDelegatedActionService,
  secureActionService,
  taskService,
} from "../services";
import { runService } from "../services/run.service";
import { runPostFixVerificationWorkflow } from "./postFixVerification.workflow";
import { queueWorkflowDelegatedAction } from "./delegatedActionQueue";
import { PendingDelegatedAction, SecureActionExecutionResult } from "../../types";

export async function startSecureActionDemoWorkflow(
  taskId: string,
  proposalId: string,
): Promise<PendingDelegatedAction> {
  const task = await taskService.getTaskById(taskId);
  const run = await taskService.getActiveAgentRun(taskId);
  const proposal = await patchProposalService.getPatchProposalById(proposalId);

  if (!task || !run || !proposal) {
    throw new Error("Task, active run, or patch proposal is missing.");
  }

  if (!task.gitlabProjectId) {
    throw new Error("A GitLab project is required for the secure demo flow.");
  }

  const existingPendingAction = (
    await pendingDelegatedActionService.getPendingActionsForTask(taskId)
  ).find(
    (action) =>
      action.actionKey === "gitlab.open_draft_pr" &&
      action.status !== "rejected" &&
      action.status !== "expired" &&
      action.status !== "cancelled",
  );
  if (existingPendingAction) {
    return existingPendingAction;
  }

  await taskService.appendAgentMessage({
    taskId,
    sender: "devpilot",
    content:
      "Preparing the secure handoff: DevPilot will stage the review package, pause for approval before the repo write, and keep provider execution behind the secure backend boundary.",
    kind: "info",
    timestamp: Date.now(),
  });

  await runService.createAgentEvent({
    taskId,
    source: "orchestrator",
    type: "STATUS_CHANGED",
    title: "Secure Demo Flow Started",
    description: "Preparing a supervised repo handoff for the Auth0 secure action demo.",
    metadata: JSON.stringify({ proposalId }),
    timestamp: Date.now(),
  });

  await gitlabDuoAdapter.invokeAgent(taskId, "handoff_to_gitlab", "system");
  await gitlabDuoAdapter.invokeAgent(taskId, "apply_repository_mutation", "system");

  const branchName = `codex/secure-demo-${taskId.slice(0, 6)}-${Date.now()
    .toString()
    .slice(-5)}`;
  const patchFiles = await patchProposalService.getPatchFilesForProposal(proposalId);
  const gitlabFiles = patchFiles
    .filter((file) => file.changeType === "create" || file.changeType === "update")
    .map((file) => ({
      filePath: file.filePath,
      content: file.nextContent || "",
      action: file.changeType,
    }))
    .filter((file) => file.content.length > 0);

  if (gitlabFiles.length === 0) {
    gitlabFiles.push({
      filePath: "docs/devpilot/secure-demo-handoff.md",
      content: buildSecureDemoFallbackContent({
        repo: task.repo,
        title: proposal.title,
        summary: proposal.summary,
        explanation: proposal.explanation,
      }),
      action: "create",
    });

    await taskService.appendAgentMessage({
      taskId,
      sender: "system",
      content:
        "No repo-ready file payload was attached to the proposal, so DevPilot added a deterministic secure handoff note to keep the demo branch reliable.",
      kind: "info",
      timestamp: Date.now(),
    });
  }

  const branchResult = await gitlabRepositoryAdapter.createBranch(
    branchName,
    task.gitlabProjectId,
    task.branch || task.defaultBranch,
  );
  if (!branchResult.success || !branchResult.data) {
    throw new Error(branchResult.error || "Unable to create the secure demo branch.");
  }

  await gitlabRepositoryService.createRepositoryAction({
    taskId,
    proposalId,
    actionType: "create_branch",
    status: "completed",
    mode: "live",
    gitlabRef: branchResult.data.branchName,
    summary: "Prepared secure demo branch for supervised repo handoff.",
    metadata: JSON.stringify(branchResult),
    startedAt: Date.now(),
    updatedAt: Date.now(),
    completedAt: Date.now(),
  });

  const commitResult = await gitlabRepositoryAdapter.applyPatch(
    branchName,
    gitlabFiles,
    `Secure demo: ${proposal.title}\n\nPrepared by DevPilot for supervised handoff.`,
    task.gitlabProjectId,
  );
  if (!commitResult.success || !commitResult.data) {
    throw new Error(commitResult.error || "Unable to stage the secure demo patch.");
  }

  await gitlabRepositoryService.createRepositoryAction({
    taskId,
    proposalId,
    actionType: "apply_patch",
    status: "completed",
    mode: "live",
    gitlabRef: commitResult.data.commitSha,
    summary: "Prepared the patch contents before the supervised repo write.",
    metadata: JSON.stringify(commitResult),
    startedAt: Date.now(),
    updatedAt: Date.now(),
    completedAt: Date.now(),
  });

  await taskService.updateTask(taskId, {
    branch: branchName,
    codeFixStatus: "approved",
  });

  await ensureVerificationPlan(taskId, proposalId);

  const pendingAction = await secureActionService.previewDelegatedAction({
    taskId,
    provider: "gitlab",
    actionKey: "gitlab.open_draft_pr",
    title: `Open draft GitLab MR for ${proposal.title}`,
    summary:
      "High-risk repo write for the secure demo flow. DevPilot will pause for approval and step-up before it opens the draft merge request.",
    metadata: {
      projectId: task.gitlabProjectId,
      repoPath: task.repo,
      repoName: task.repoName || task.repo,
      sourceBranch: branchName,
      targetBranch: task.defaultBranch || task.branch,
      title: `[DevPilot] ${proposal.title}`,
      description: [
        "## DevPilot Secure Demo Handoff",
        proposal.summary,
        proposal.explanation,
        `Confidence: ${Math.round(proposal.confidence * 100)}%`,
      ].join("\n\n"),
      proposalId,
      secureDemoFlow: "gitlab_slack_verification",
      slackChannelId: config.defaultSlackChannelId,
      slackChannelName: config.defaultSlackChannelName,
    },
  });

  await taskService.appendAgentMessage({
    taskId,
    sender: "system",
    content:
      "The review package is staged on a secure demo branch. Approval is now required before the repo write, and step-up will be enforced before DevPilot opens the draft merge request.",
    kind: "warning",
    timestamp: Date.now(),
  });

  return pendingAction;
}

export async function continueSecureActionDemoWorkflow(
  result: SecureActionExecutionResult,
): Promise<void> {
  if (
    result.ok &&
    result.execution.actionKey === "gitlab.create_draft_issue" &&
    result.execution.status === "completed" &&
    result.execution.taskId
  ) {
    await handleFallbackIssueCompletion(result);
    return;
  }

  if (
    !result.ok ||
    result.execution.actionKey !== "gitlab.open_draft_pr" ||
    result.execution.status !== "completed" ||
    !result.execution.taskId
  ) {
    return;
  }

  const taskId = result.execution.taskId;
  const metadata = parseExecutionMetadata(result.execution.metadata);
  const request = metadata.request;
  const response = metadata.response;
  const proposalId = asOptionalString(request.proposalId);
  const mergeRequestIid = asNumber(response.iid ?? result.execution.externalRef);
  const webUrl = asOptionalString(response.webUrl) ?? result.execution.externalUrl;
  const sourceBranch = asOptionalString(request.sourceBranch) ?? "";
  const targetBranch = asOptionalString(request.targetBranch) ?? "";
  const title = asOptionalString(response.title) ?? result.execution.summary;

  if (proposalId && mergeRequestIid) {
    const existingRecord = await gitlabRepositoryService.getMRRecordForTask(taskId);
    if (existingRecord) {
      await gitlabRepositoryService.updateMergeRequestRecord(existingRecord.id, {
        mergeRequestIid,
        title,
        status: "opened",
        webUrl,
        sourceBranch,
        targetBranch,
        approvedAt: Date.now(),
      });
    } else {
      await gitlabRepositoryService.createMergeRequestRecord({
        taskId,
        proposalId,
        mergeRequestIid,
        title,
        status: "opened",
        webUrl,
        sourceBranch,
        targetBranch,
        approvedAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    await gitlabRepositoryService.createRepositoryAction({
      taskId,
      proposalId,
      actionType: "create_mr",
      status: "completed",
      mode: "live",
      gitlabRef: String(mergeRequestIid),
      summary: `Opened secure draft MR !${mergeRequestIid}.`,
      metadata: result.execution.metadata,
      startedAt: result.execution.createdAt,
      updatedAt: Date.now(),
      completedAt: result.execution.completedAt ?? Date.now(),
    });

    await patchProposalService.updatePatchProposalStatus(proposalId, "applied");
  }

  await taskService.appendAgentMessage({
    taskId,
    sender: "devpilot",
    content: webUrl
      ? `Approval completed. DevPilot opened draft MR !${mergeRequestIid} through secure delegated access and linked it back into the workspace: ${webUrl}`
      : "Approval completed. DevPilot opened the draft merge request through the protected backend boundary.",
    kind: "success",
    timestamp: Date.now(),
  });

  await runService.createAgentEvent({
    taskId,
    source: "orchestrator",
    type: "REPOSITORY_ACTION",
    title: "Secure Draft MR Created",
    description: `Draft MR !${mergeRequestIid ?? "pending"} is ready for review.`,
    metadata: JSON.stringify({
      mergeRequestIid,
      webUrl,
      sourceBranch,
      targetBranch,
      executionId: result.execution.id,
    }),
    timestamp: Date.now(),
  });

  if (request.slackChannelId) {
    await queueWorkflowDelegatedAction(
      taskId,
      {
        provider: "slack",
        actionKey: "slack.post_status_message",
        title: "Send secure review-ready Slack update",
        summary:
          "Narrow review-ready Slack update after the supervised repo action completes.",
        metadata: {
          channelId: asOptionalString(request.slackChannelId) ?? "",
          channelName: asOptionalString(request.slackChannelName),
          notificationClass: "narrow_status",
          notificationCategory: "review_ready",
          text: [
            `DevPilot opened a supervised draft GitLab MR for "${title}".`,
            mergeRequestIid ? `MR !${mergeRequestIid}: ${webUrl}` : webUrl || "Provider record linked in DevPilot.",
            "Execution stayed behind the secure Auth0-backed backend boundary.",
          ].join("\n"),
        },
      },
      { executeImmediatelyWhenSafe: true },
    );
  } else if (config.liveSlackActionMode) {
    await taskService.appendAgentMessage({
      taskId,
      sender: "system",
      content:
        "Slack delivery is available, but no default review channel is configured, so the team update was skipped safely.",
      kind: "warning",
      timestamp: Date.now(),
    });
  }

  await gitlabDuoAdapter.invokeAgent(taskId, "verify_fix", "verifier");
  await runPostFixVerificationWorkflow(taskId);
}

async function handleFallbackIssueCompletion(
  result: SecureActionExecutionResult,
): Promise<void> {
  const taskId = result.execution.taskId;
  if (!taskId) {
    return;
  }

  const metadata = parseExecutionMetadata(result.execution.metadata);
  const response = metadata.response;
  const issueRef = asNumber(response.iid ?? result.execution.externalRef);
  const issueUrl = asOptionalString(response.web_url) ?? result.execution.externalUrl;

  await taskService.appendAgentMessage({
    taskId,
    sender: "devpilot",
    content: issueUrl
      ? `Fallback-secure repo action complete. DevPilot created review-ready issue #${issueRef} through the secure backend path: ${issueUrl}`
      : "Fallback-secure repo action complete. DevPilot created the review-ready issue through the protected backend path.",
    kind: "success",
    timestamp: Date.now(),
  });

  if (config.defaultSlackChannelId) {
    await queueWorkflowDelegatedAction(
      taskId,
      {
        provider: "slack",
        actionKey: "slack.post_status_message",
        title: "Send fallback-secure Slack update",
        summary:
          "Narrow team update after the fallback-secure repo action completes.",
        metadata: {
          channelId: config.defaultSlackChannelId,
          channelName: config.defaultSlackChannelName,
          notificationClass: "narrow_status",
          notificationCategory: "fallback_repo_action",
          text: [
            `DevPilot completed a supervised fallback repo action for "${result.execution.summary}".`,
            issueUrl ? `Review-ready issue: ${issueUrl}` : "Provider record linked in DevPilot.",
            "The action stayed behind the secure backend boundary and did not expose provider tokens in the browser.",
          ].join("\n"),
        },
      },
      { executeImmediatelyWhenSafe: true },
    );
  }
}

async function ensureVerificationPlan(
  taskId: string,
  proposalId: string,
): Promise<void> {
  const task = await taskService.getTaskById(taskId);
  const proposal = await patchProposalService.getPatchProposalById(proposalId);
  const existingPlan = await patchProposalService.getVerificationPlanForTask(taskId);

  if (!task || !proposal || (existingPlan && existingPlan.proposalId === proposalId)) {
    return;
  }

  await patchProposalService.createVerificationPlan({
    id: crypto.randomUUID(),
    taskId,
    proposalId,
    targetUrl: task.targetUrl || "",
    expectedOutcome:
      proposal.summary ||
      task.prompt ||
      "Verify that the approved change resolves the reported issue.",
    checks: [
      "Confirm the reported issue no longer appears in the live application.",
      "Compare the new UI state against the inspection evidence.",
      "Review browser console output for regressions after the change.",
    ],
    createdAt: Date.now(),
  });
}

function parseExecutionMetadata(
  value: string,
): {
  request: Record<string, unknown>;
  response: Record<string, unknown>;
} {
  try {
    const parsed = JSON.parse(value) as {
      request?: Record<string, unknown>;
      response?: Record<string, unknown>;
    };

    return {
      request: parsed.request ?? {},
      response: parsed.response ?? {},
    };
  } catch {
    return {
      request: {},
      response: {},
    };
  }
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function buildSecureDemoFallbackContent(args: {
  repo: string;
  title: string;
  summary: string;
  explanation: string;
}): string {
  return [
    "# DevPilot Secure Demo Handoff",
    "",
    `Repository: ${args.repo}`,
    `Proposal: ${args.title}`,
    "",
    "## Summary",
    args.summary,
    "",
    "## Why Approval Matters",
    "This repo write is supervised because it changes shared project state and can influence reviewer workflow.",
    "",
    "## Notes",
    args.explanation,
  ].join("\n");
}
