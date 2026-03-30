import { VIEWPORT_PRESETS } from "../adapters/browserAutomation.adapter";
import {
  ExecutionResult,
  sandboxAdapter,
} from "../adapters/sandbox.adapter";
import { gitlabDuoAdapter } from "../adapters/gitlabDuo.adapter";
import { visionAnalysisAdapter } from "../adapters/visionAnalysis.adapter";
import { taskService } from "../services";
import { memoryService } from "../services/memory.service";
import { runService } from "../services/run.service";
import { runPlanCodeFixWorkflow } from "./planCodeFix.workflow";

const MAX_FAILURE_EVIDENCE_LINES = 14;
const MAX_CONSOLE_EVIDENCE_LINES = 40;

type InspectionStage = "install" | "build";

interface InspectionAnalysis {
  summary?: string;
  issueType?: string;
  severity?: string;
  suspectedComponent?: string;
  explanation?: string;
  recommendedFix?: string;
  confidence?: number;
  evidence?: string[];
  suggestedTags?: string[];
}

function combineExecutionOutput(result: ExecutionResult): string {
  return [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join("\n\n").trim();
}

function extractEvidenceLines(output: string, maxLines: number): string[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-maxLines);
}

function toConsoleEvidence(output: string): string[] {
  return extractEvidenceLines(output, MAX_CONSOLE_EVIDENCE_LINES);
}

function extractReferencedPaths(output: string): string[] {
  const matches =
    output.match(/(?:\.{0,2}\/)?[A-Za-z0-9@._/-]+\.(?:tsx?|jsx?|css|scss|mjs|cjs|json)/g) ||
    [];

  return Array.from(new Set(matches.filter((match) => match.includes("/")))).slice(0, 6);
}

function toFallbackInspectionAnalysis(args: {
  command: string;
  output: string;
  stage: InspectionStage;
  targetUrl: string;
}): InspectionAnalysis {
  const evidence = extractEvidenceLines(args.output, MAX_FAILURE_EVIDENCE_LINES);
  const filePaths = extractReferencedPaths(args.output);
  const suspectedComponent = filePaths[0]
    ? filePaths[0].split("/").pop()?.replace(/\.[^.]+$/, "") || filePaths[0]
    : "application-bootstrap";
  const failureLabel = args.stage === "install" ? "dependency installation" : "production build";

  return {
    summary:
      args.stage === "install"
        ? `Dependencies failed to install, so the sandbox never reached ${args.targetUrl}.`
        : `The application failed during build, so DevPilot could not open ${args.targetUrl}.`,
    issueType: args.stage === "install" ? "console_error" : "rendering_failure",
    severity: "high",
    suspectedComponent,
    explanation:
      `Inspection switched to log-only mode because '${args.command}' exited with a non-zero status during sandbox preparation. ` +
      `The terminal output points to ${failureLabel} blockers that must be resolved before a live browser session can start.`,
    recommendedFix:
      args.stage === "install"
        ? "Resolve the dependency or package-manager errors in the captured terminal output, then rerun inspection."
        : "Fix the build-time compile or prerender errors in the captured terminal output, then rerun inspection.",
    confidence: 0.9,
    evidence,
    suggestedTags: [
      "inspection-blocker",
      "sandbox-preflight",
      args.stage === "install" ? "dependency-install" : "build-failure",
    ],
  };
}

export const runUiInspectionWorkflow = async (taskId: string) => {
  const task = await taskService.getTaskById(taskId);
  const run = await taskService.getActiveAgentRun(taskId);
  if (!task || !run || run.status !== "running") {
    return;
  }

  const { config } = await import("../config/env");
  let targetUrl = "http://127.0.0.1:3000";
  const serverId = `server-${taskId}`;

  const preset = task.viewportPreset || "desktop";
  const viewport = VIEWPORT_PRESETS[preset] || VIEWPORT_PRESETS.desktop;

  await taskService.updateTask(taskId, { inspectionStatus: "running" });
  await taskService.appendAgentMessage({
    taskId,
    sender: "system",
    content: `Starting UI inspection for ${task.title}.`,
    kind: "thinking",
    timestamp: Date.now(),
  });

  const workflowSteps = [
    {
      key: "build_app",
      label: "Build Application",
      detail: "Installing dependencies and building the project...",
    },
    {
      key: "browser_session",
      label: "Launch Browser",
      detail: "Initializing the sandbox browser...",
    },
    {
      key: "capture_ui",
      label: "Capture UI",
      detail: `Navigating to ${targetUrl}`,
    },
    {
      key: "retrieve_memory",
      label: "Retrieve Memory",
      detail: "Looking for related verified fixes...",
    },
    {
      key: "analyze_vision",
      label: "Vision Analysis",
      detail: "Analyzing the captured UI with Gemini...",
    },
    {
      key: "complete_inspection",
      label: "Inspection Complete",
      detail: "Saving inspection results...",
    },
  ];

  await gitlabDuoAdapter.invokeAgent(taskId, "inspect_ui_issue", "ui_inspector");
  await runService.updateAgentRunProgress(run.id, 0, "Initializing UI inspection...");
  const stepRecords = await Promise.all(
    workflowSteps.map((step, index) =>
      runService.createRunStep({
        runId: run.id,
        taskId,
        order: index + 1,
        key: step.key,
        label: step.label,
        status: "pending",
        detail: step.detail,
        phase: "inspection",
      }),
    ),
  );

  let currentStepIndex = 0;
  let terminalArtifactId: string | undefined;
  let screenshotArtifactId: string | undefined;

  const completeStep = async (index: number, detail: string) => {
    await runService.updateRunStepStatus(stepRecords[index], "completed", detail);
    await runService.updateAgentRunProgress(
      run.id,
      index + 1,
      workflowSteps[index + 1]?.detail || "Done",
    );
  };

  const markStepRunning = async (index: number, detail: string) => {
    currentStepIndex = index;
    await runService.updateRunStepStatus(stepRecords[index], "running", detail);
  };

  const markBrowserStepsSkipped = async (reason: string) => {
    await runService.updateRunStepStatus(stepRecords[1], "completed", reason);
    await runService.updateRunStepStatus(stepRecords[2], "completed", reason);
    await runService.updateAgentRunProgress(
      run.id,
      3,
      workflowSteps[3]?.detail || "Looking for related verified fixes...",
    );
  };

  try {
    let bootstrapMetadata:
      | Awaited<ReturnType<typeof sandboxAdapter.setupWorkspace>>
      | null = null;
    let consoleEvidence: string[] = [];
    let screenshotBase64: string | undefined;
    let fallbackAnalysis: InspectionAnalysis | null = null;

    await markStepRunning(
      0,
      "Setting up sandbox workspace (cloning repository)...",
    );

    try {
      const { config: coreConfig } = await import("../config/env");
      const gitlabUrl = task.gitlabProjectWebUrl || task.repo;
      if (!gitlabUrl) {
        throw new Error("GitLab project URL is missing from task.");
      }
      bootstrapMetadata = await sandboxAdapter.setupWorkspace(
        gitlabUrl,
        task.branch,
        coreConfig.gitlabToken,
      );
      targetUrl = bootstrapMetadata.runtimeTargetUrl;
      await taskService.updateTask(taskId, {
        sandboxUrl: config.sandboxUrl,
        inspectionTargetUrl: targetUrl,
      });
      console.log(
        `[WORKFLOW] Sandbox workspace ready for ${gitlabUrl} @ ${task.branch}. ` +
          `appRoot=${bootstrapMetadata.appRoot}, framework=${bootstrapMetadata.framework}, ` +
          `packageManager=${bootstrapMetadata.packageManager}, runtimeTargetUrl=${targetUrl}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to setup sandbox workspace: ${message}`);
    }

    const installCommand = bootstrapMetadata?.installCommandUsed || "npm install";
    const buildCommand = bootstrapMetadata?.buildCommandUsed;
    const runtimeCommand =
      bootstrapMetadata?.devCommandUsed || bootstrapMetadata?.previewCommandUsed;

    const switchToLogOnlyInspection = async (
      stage: InspectionStage,
      command: string,
      result: ExecutionResult,
    ) => {
      const output =
        combineExecutionOutput(result) ||
        `${stage === "install" ? "Dependency installation" : "Build"} failed while running '${command}'.`;

      terminalArtifactId = await taskService.updateTaskArtifact(
        taskId,
        "terminal",
        output,
      );
      consoleEvidence = toConsoleEvidence(output);
      fallbackAnalysis = toFallbackInspectionAnalysis({
        command,
        output,
        stage,
        targetUrl,
      });
      await taskService.updateTaskArtifact(
        taskId,
        "vision_analysis",
        JSON.stringify(fallbackAnalysis, null, 2),
      );
      await runService.createAgentEvent({
        taskId,
        source: "orchestrator",
        type: "ARTIFACT_UPDATED",
        title:
          stage === "install"
            ? "Dependency failure captured"
            : "Build failure captured",
        description:
          "Stored terminal output and generated fallback inspection evidence for planning.",
        metadata: JSON.stringify({ terminalArtifactId }),
        timestamp: Date.now(),
      });
      await taskService.appendAgentMessage({
        taskId,
        sender: "system",
        content:
          `${stage === "install" ? "Dependency installation" : "Build"} failed while running '${command}'. ` +
          "Continuing with log-only inspection.",
        kind: "warning",
        artifactIds: [terminalArtifactId],
        timestamp: Date.now(),
      });
      await completeStep(
        0,
        `${stage === "install" ? "Dependency installation" : "Build"} failed. Continuing with log-only inspection.`,
      );
      await markBrowserStepsSkipped(
        "Skipped because the application never reached a runnable state.",
      );
    };

    await markStepRunning(
      0,
      buildCommand
        ? `Running '${installCommand}' and '${buildCommand}'...`
        : `Running '${installCommand}'...`,
    );

    const installResult = await sandboxAdapter.executeCommand(installCommand);
    if (installResult.exitCode !== 0) {
      await switchToLogOnlyInspection("install", installCommand, installResult);
    } else if (buildCommand) {
      const buildResult = await sandboxAdapter.executeCommand(buildCommand);

      if (buildResult.exitCode !== 0) {
        await switchToLogOnlyInspection("build", buildCommand, buildResult);
      }
    }

    if (!fallbackAnalysis) {
      await completeStep(
        0,
        buildCommand
          ? "Application built successfully."
          : "Dependencies installed successfully.",
      );

      if (!runtimeCommand) {
        throw new Error(
          "No runtime command could be resolved for the detected application.",
        );
      }

      await sandboxAdapter.startBackgroundCommand(serverId, runtimeCommand);

      const readiness = await sandboxAdapter.waitForUrl(targetUrl, 60000, 2000);

      if (!readiness.ready) {
        await sandboxAdapter.stopBackgroundCommand(serverId);
        throw new Error(
          `Server at ${targetUrl} did not become ready after 60s. ` +
            `Last error: ${readiness.lastError || "unknown"}`,
        );
      }

      await markStepRunning(1, "Launching sandbox session...");

      const sandboxSession = await sandboxAdapter.createSession({
        id: taskId,
        targetUrl,
        viewport,
      });
      await completeStep(1, "Sandbox session established.");

      await markStepRunning(2, "Capturing screenshot and console logs...");
      screenshotBase64 = await sandboxAdapter.captureScreenshot(taskId);
      const liveSession =
        (await sandboxAdapter.getSession(taskId)) || sandboxSession;

      consoleEvidence = liveSession.consoleLogs;
      terminalArtifactId = await taskService.updateTaskArtifact(
        taskId,
        "terminal",
        liveSession.consoleLogs.join("\n"),
      );
      screenshotArtifactId = await taskService.updateTaskArtifact(
        taskId,
        "screenshot",
        screenshotBase64,
      );
      await runService.createAgentEvent({
        taskId,
        source: "orchestrator",
        type: "ARTIFACT_UPDATED",
        title: "Inspection evidence captured",
        description: "Stored the live screenshot and console log artifacts.",
        metadata: JSON.stringify({ terminalArtifactId, screenshotArtifactId }),
        timestamp: Date.now(),
      });
      await completeStep(2, `Captured ${liveSession.currentUrl}.`);
    }

    await markStepRunning(3, "Searching historical memory...");
    const memory = await memoryService.getRelevantMemoryForTask(taskId);
    let priorMemoryHints = "";
    if (memory) {
      priorMemoryHints = `Past similar issue: ${memory.title}. ${memory.content}`;
      await memoryService.attachMemoryHitToTask(
        taskId,
        memory.id,
        0.88,
        "Matched against a previously verified task.",
      );
    }
    await completeStep(3, "Historical memory loaded.");

    await gitlabDuoAdapter.invokeAgent(
      taskId,
      "normalize_findings",
      "ui_inspector",
    );
    await markStepRunning(
      4,
      fallbackAnalysis
        ? "Summarizing terminal evidence for planning..."
        : "Requesting Gemini vision analysis...",
    );

    const analysis: InspectionAnalysis =
      fallbackAnalysis ||
      (await (async () => {
        let repoFiles: Array<{ filePath: string; content: string }> = [];
        try {
          const { gitlabRepositoryAdapter } = await import(
            "../adapters/gitlabRepository.adapter"
          );
          const treeResult = await gitlabRepositoryAdapter.listRepositoryTree(
            task.gitlabProjectId,
            task.branch,
          );

          if (treeResult.success && treeResult.data) {
            const relevantPaths = treeResult.data
              .filter(
                (file) =>
                  file.type === "blob" &&
                  (file.path.includes("src/components") ||
                    file.path.includes("src/pages") ||
                    file.path.includes("src/App") ||
                    file.path.includes(".css") ||
                    file.path.includes(".scss")),
              )
              .slice(0, 15);

            const fetchedFiles = await Promise.all(
              relevantPaths.map(async (file) => {
                const contentResult =
                  await gitlabRepositoryAdapter.getFileContent(
                    file.path,
                    task.gitlabProjectId,
                    task.branch,
                  );
                return contentResult.success
                  ? { filePath: file.path, content: contentResult.data.content }
                  : null;
              }),
            );
            repoFiles = fetchedFiles.filter(
              (
                file,
              ): file is {
                filePath: string;
                content: string;
              } => file !== null,
            );
          }
        } catch (error) {
          console.warn(
            "Failed to fetch repository files for vision analysis context:",
            error,
          );
        }

        return visionAnalysisAdapter.analyzeUi({
          taskTitle: task.title,
          targetUrl,
          viewportWidth: viewport.width,
          viewportHeight: viewport.height,
          screenshotBase64,
          consoleErrors: consoleEvidence,
          priorMemoryHints,
          repoFiles,
        });
      })());

    await taskService.updateTaskArtifact(
      taskId,
      "vision_analysis",
      JSON.stringify(analysis, null, 2),
    );

    const artifactIds = [screenshotArtifactId, terminalArtifactId].filter(
      (artifactId): artifactId is string => Boolean(artifactId),
    );
    await taskService.appendAgentMessage({
      taskId,
      sender: "devpilot",
      content: fallbackAnalysis
        ? `Inspection complete in log-only mode: ${analysis.summary || "Build failure evidence is ready for code-fix planning."}`
        : `Vision analysis complete: detected ${analysis.issueType}. Recommended fix: ${analysis.recommendedFix}`,
      kind:
        fallbackAnalysis || analysis.severity === "high" ? "warning" : "info",
      artifactIds,
      timestamp: Date.now(),
    });
    await completeStep(
      4,
      fallbackAnalysis
        ? "Fallback analysis generated from terminal output."
        : "Vision analysis generated.",
    );

    await markStepRunning(5, "Finalizing inspection artifacts...");
    await taskService.updateTask(taskId, {
      inspectionStatus: "completed",
      lastInspectionAt: Date.now(),
    });
    await completeStep(
      5,
      fallbackAnalysis
        ? "Inspection finished in log-only mode."
        : "Inspection finished.",
    );

    await taskService.appendAgentMessage({
      taskId,
      sender: "system",
      content: fallbackAnalysis
        ? "Inspection complete in log-only mode. Proceeding to code fix generation."
        : "Inspection complete. Proceeding to code fix generation.",
      kind: "success",
      timestamp: Date.now(),
    });

    await sandboxAdapter.stopBackgroundCommand(serverId);
    await sandboxAdapter.closeSession(taskId);
    await runPlanCodeFixWorkflow(taskId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await runService.updateRunStepStatus(
      stepRecords[currentStepIndex],
      "failed",
      message,
    );
    await runService.updateAgentRunProgress(
      run.id,
      currentStepIndex,
      "Inspection error.",
      "failed",
    );
    await taskService.updateTask(taskId, { inspectionStatus: "failed" });
    await runService.createAgentEvent({
      taskId,
      source: "system",
      type: "RUN_FAILED",
      title: "Inspection Failed",
      description: message,
      metadata: "{}",
      timestamp: Date.now(),
    });
    await taskService.appendAgentMessage({
      taskId,
      sender: "system",
      content: `Inspection workflow failed: ${message}`,
      kind: "warning",
      artifactIds: terminalArtifactId ? [terminalArtifactId] : undefined,
      timestamp: Date.now(),
    });

    await sandboxAdapter.stopBackgroundCommand(serverId).catch(() => {});
    await sandboxAdapter.closeSession(taskId);
  }
};
