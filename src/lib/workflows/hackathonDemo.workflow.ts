import { gitlabDuoAdapter } from "../adapters/gitlabDuo.adapter";
import { config } from "../config/env";
import { devpilotFlow } from "../gitlab-duo/flows/devpilot.flow";
import { demoScenarioService, DemoScenarioKind } from "../services/demoScenario.service";
import {
  codeReviewIssueService,
  patchProposalService,
  runService,
  secureActionService,
  taskService,
} from "../services";
import { GitLabProjectSummary } from "../../types";

const SHOWCASE_COMPONENT_HINT = "hackathon_demo_showcase";

export async function launchHackathonDemoWorkflow(options: {
  scenario: DemoScenarioKind;
  project?: GitLabProjectSummary;
  branch: string;
  targetAppBaseUrl: string;
}): Promise<string> {
  const existingTask = await findReusableShowcaseTask(options.scenario);
  if (existingTask) {
    return existingTask.id;
  }

  const seed = demoScenarioService.buildSeed({
    scenario: options.scenario,
    project: options.project,
    branch: options.branch,
    targetAppBaseUrl: options.targetAppBaseUrl,
  });
  const now = Date.now();
  const taskId = crypto.randomUUID();
  const proposalId = crypto.randomUUID();
  const runId = crypto.randomUUID();

  await codeReviewIssueService.upsertDiscoveredIssues({
    repo: seed.repo,
    repoName: seed.repoName,
    branch: seed.branch,
    defaultBranch: seed.defaultBranch,
    gitlabProjectId: seed.gitlabProjectId,
    gitlabProjectWebUrl: seed.gitlabProjectWebUrl,
    discoveryMode: "hackathon_demo_showcase",
    issues: [
      {
        title: seed.issue.title,
        summary: seed.issue.summary,
        category: seed.issue.category,
        severity: seed.issue.severity,
        confidence: seed.issue.confidence,
        score: seed.issue.score,
        easeOfFix: seed.issue.easeOfFix,
        impactBreadth: seed.issue.impactBreadth,
        source: "background_discovery",
        relatedFiles: seed.issue.relatedFiles,
        evidence: seed.issue.evidence,
        suggestedPrompt: seed.issue.suggestedPrompt,
        dedupeKey: seed.issue.dedupeKey,
      },
    ],
  });

  const seededIssue = await codeReviewIssueService.getIssueByDedupeKey(
    seed.issue.dedupeKey,
  );

  await taskService.createTask({
    id: taskId,
    title: seed.taskTitle,
    prompt: seed.taskPrompt,
    repo: seed.repo,
    repoName: seed.repoName,
    repoPath: seed.repo,
    branch: seed.branch,
    baseBranch: seed.branch,
    targetBranch: seed.defaultBranch,
    defaultBranch: seed.defaultBranch,
    gitlabProjectId: seed.gitlabProjectId,
    gitlabProjectWebUrl: seed.gitlabProjectWebUrl,
    status: "running",
    category: "tasks",
    createdAt: now,
    updatedAt: now,
    plusCount: 42,
    minusCount: 0,
    targetUrl: options.targetAppBaseUrl,
    sandboxUrl: config.sandboxUrl,
    viewportPreset: "desktop",
    lastInspectionAt: now - 1000 * 60 * 8,
    inspectionStatus: "completed",
    codeFixStatus: "ready_for_review",
    candidateFiles: seed.candidateFiles,
    componentHints: seed.componentHints,
  });

  await runService.createAgentRun({
    id: runId,
    taskId,
    status: "running",
    currentStep: seed.run.currentStep,
    startedAt: now - 1000 * 60 * 12,
    updatedAt: now,
    progress: seed.run.progress,
    totalSteps: seed.run.totalSteps,
    completedSteps: seed.run.completedSteps,
    mode: "live",
    phase: seed.run.phase,
  });

  await gitlabDuoAdapter.initializeFlowRun(taskId, devpilotFlow.id);
  await createShowcaseRunSteps(taskId, runId, now, options.scenario);
  await createShowcaseProposal(
    taskId,
    proposalId,
    now,
    seed,
    options.targetAppBaseUrl,
  );

  await taskService.updateTaskArtifact(taskId, "screenshot", seed.artifacts.screenshot);
  await taskService.updateTaskArtifact(taskId, "terminal", seed.artifacts.terminal);
  await taskService.updateTaskArtifact(taskId, "vision_analysis", seed.artifacts.visionAnalysis);

  for (const message of seed.initialMessages) {
    await taskService.appendAgentMessage({
      taskId,
      ...message,
      timestamp: now - 1000 * 60 * 2,
    });
  }

  await runService.createAgentEvent({
    taskId,
    source: "orchestrator",
    type: "STATUS_CHANGED",
    title: "Hackathon showcase prepared",
    description:
      options.scenario === "golden_path"
        ? "Review-ready secure handoff showcase is ready."
        : options.scenario === "fallback_path"
          ? "Fallback-secure showcase is ready."
          : "Blocked-path showcase is ready.",
    metadata: JSON.stringify({
      scenario: options.scenario,
      proposalId,
    }),
    timestamp: now,
  });

  if (seededIssue) {
    await codeReviewIssueService.markIssueStarted(seededIssue.id, taskId);
  }

  if (options.scenario === "fallback_path") {
    await seedFallbackAction(taskId, seed, proposalId);
  }

  if (options.scenario === "blocked_provider") {
    await seedBlockedAction(taskId, seed, proposalId);
  }

  return taskId;
}

async function createShowcaseRunSteps(
  taskId: string,
  runId: string,
  now: number,
  scenario: DemoScenarioKind,
): Promise<void> {
  const runSteps = [
    {
      label: "Discovery",
      detail: "Background issue discovery highlighted the secure approval surface.",
      status: "completed" as const,
    },
    {
      label: "Inspection",
      detail: "UI inspection summarized the approval-layout friction and preserved the sandbox evidence.",
      status: "completed" as const,
    },
    {
      label: "Patch Proposal",
      detail: "DevPilot prepared a review-ready patch package for the secure handoff story.",
      status: "completed" as const,
    },
    {
      label: "Secure Handoff",
      detail:
        scenario === "golden_path"
          ? "Approval boundary is ready for a supervised repo write."
          : scenario === "fallback_path"
            ? "Fallback-secure action is ready for approval."
            : "Blocked-provider scenario is ready to demonstrate a safe stop.",
      status: "running" as const,
    },
  ];

  for (const [index, step] of runSteps.entries()) {
    await runService.createRunStep({
      runId,
      taskId,
      order: index + 1,
      key: `hackathon_demo_${index + 1}`,
      label: step.label,
      status: step.status,
      detail: step.detail,
      phase: index < 2 ? "inspection" : "code_fix",
      startedAt: now - 1000 * 60 * (8 - index),
      completedAt: step.status === "completed" ? now - 1000 * 60 * (7 - index) : undefined,
    });
  }
}

async function createShowcaseProposal(
  taskId: string,
  proposalId: string,
  now: number,
  seed: ReturnType<typeof demoScenarioService.buildSeed>,
  targetAppBaseUrl: string,
): Promise<void> {
  await patchProposalService.createPatchProposal({
    id: proposalId,
    taskId,
    source: "hybrid",
    status: "ready_for_review",
    title: seed.proposal.title,
    summary: seed.proposal.summary,
    suspectedFiles: seed.proposal.suspectedFiles,
    recommendedStrategy: seed.proposal.recommendedStrategy,
    explanation: seed.proposal.explanation,
    confidence: seed.proposal.confidence,
    createdAt: now - 1000 * 60 * 4,
    updatedAt: now,
  });

  for (const patchFile of seed.patchFiles) {
    await patchProposalService.createPatchFile({
      id: crypto.randomUUID(),
      proposalId,
      taskId,
      filePath: patchFile.filePath,
      changeType: patchFile.changeType,
      patch: patchFile.patch,
      nextContent: patchFile.nextContent,
      explanation: patchFile.explanation,
      createdAt: now - 1000 * 60 * 4,
    });
  }

  await patchProposalService.createVerificationPlan({
    id: crypto.randomUUID(),
    taskId,
    proposalId,
    targetUrl: targetAppBaseUrl,
    expectedOutcome: seed.verificationPlan.expectedOutcome,
    checks: seed.verificationPlan.checks,
    createdAt: now - 1000 * 60 * 3,
  });
}

async function seedFallbackAction(
  taskId: string,
  seed: ReturnType<typeof demoScenarioService.buildSeed>,
  proposalId: string,
): Promise<void> {
  const pendingAction = await secureActionService.previewDelegatedAction({
    taskId,
    provider: "gitlab",
    actionKey: "gitlab.create_draft_issue",
    title: "Create supervised GitLab fallback issue",
    summary:
      "Fallback-secure repo action: create a review-ready GitLab issue when live branch staging is not available.",
    metadata: {
      projectId: seed.gitlabProjectId ?? "demo-project-fallback",
      repoPath: seed.repo,
      title: `[DevPilot] Secure fallback note for ${seed.proposal.title}`,
      description: [
        "DevPilot switched to a safer fallback action because live repo staging was not fully available.",
        seed.proposal.summary,
        `Linked proposal: ${proposalId}`,
      ].join("\n\n"),
      secureDemoFlow: "fallback_issue_handoff",
    },
  });

  await taskService.appendAgentMessage({
    taskId,
    sender: "system",
    content:
      pendingAction.approvalStatus === "pending"
        ? "Fallback path prepared. Approval is still required before DevPilot creates the review-ready GitLab issue through the secure backend boundary."
        : "Fallback path prepared for the secure demo.",
    kind: "warning",
    timestamp: Date.now(),
  });
}

async function seedBlockedAction(
  taskId: string,
  seed: ReturnType<typeof demoScenarioService.buildSeed>,
  proposalId: string,
): Promise<void> {
  const pendingAction = await secureActionService.previewDelegatedAction({
    taskId,
    provider: "gitlab",
    actionKey: "gitlab.create_draft_issue",
    title: "Attempt supervised repo action with missing provider access",
    summary:
      "Blocked-path showcase: approval remains visible, but execution will stop safely because the provider path is unavailable.",
    metadata: {
      projectId: seed.gitlabProjectId ?? "demo-project-blocked",
      repoPath: seed.repo,
      title: `[DevPilot] Blocked provider demo for ${seed.proposal.title}`,
      description: [
        "This showcase is intentionally prepared to demonstrate a safe blocked path.",
        "DevPilot should explain the missing connection or scope boundary instead of executing silently.",
        `Linked proposal: ${proposalId}`,
      ].join("\n\n"),
      secureDemoFlow: "blocked_provider_boundary",
    },
  });

  await taskService.appendAgentMessage({
    taskId,
    sender: "system",
    content:
      pendingAction.approvalStatus === "pending"
        ? "Blocked-path showcase prepared. After approval, DevPilot will attempt the delegated action and stop safely with a clear reason."
        : "Blocked-path showcase prepared.",
    kind: "warning",
    timestamp: Date.now(),
  });
}

async function findReusableShowcaseTask(
  scenario: DemoScenarioKind,
): Promise<Awaited<ReturnType<typeof taskService.getTaskById>> | undefined> {
  const tasks = await taskService.getAllTasks();
  return tasks.find(
    (task) =>
      task.componentHints?.includes(SHOWCASE_COMPONENT_HINT) &&
      task.componentHints?.includes(`scenario_${scenario}`) &&
      Date.now() - task.createdAt < 1000 * 60 * 45,
  );
}
