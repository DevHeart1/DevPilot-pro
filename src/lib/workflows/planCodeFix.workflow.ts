import { codeAgentAdapter } from "../adapters/codeAgent.adapter";
import { gitlabDuoAdapter } from "../adapters/gitlabDuo.adapter";
import { gitlabRepositoryAdapter } from "../adapters/gitlabRepository.adapter";
import { runBackgroundCodeReviewDiscoveryWorkflow } from "./backgroundCodeReviewDiscovery.workflow";
import { taskService, patchProposalService } from "../services";
import { memoryService } from "../services/memory.service";
import { runService } from "../services/run.service";

const REPOSITORY_FILE_PATTERN = /\.(tsx?|jsx?|css|scss|json|md)$/i;

function parseVisionArtifact(content?: string): Record<string, unknown> {
    if (!content) {
        return {};
    }

    try {
        return JSON.parse(content) as Record<string, unknown>;
    } catch {
        return {};
    }
}

function filterRepositoryPaths(paths: string[]): string[] {
    return paths
        .filter((path) => REPOSITORY_FILE_PATTERN.test(path))
        .filter((path) => !path.includes("node_modules"))
        .slice(0, 250);
}

export const runPlanCodeFixWorkflow = async (taskId: string) => {
    const task = await taskService.getTaskById(taskId);
    const run = await taskService.getActiveAgentRun(taskId);
    if (!task || !run || run.status !== "running") {
        return;
    }
    // Only run if we are idle or explicitly requested
    if (task.codeFixStatus && task.codeFixStatus !== "idle") {
        return;
    }

    await taskService.updateTask(taskId, { codeFixStatus: "running" });
    await taskService.appendAgentMessage({
        taskId,
        sender: "system",
        content: `Starting planning, security audit, and compliance checks for ${task.title}.`,
        kind: "thinking",
        timestamp: Date.now(),
    });

    const workflowSteps = [
        {
            key: "infer_files",
            label: "Analyze Target",
            detail: "Mapping the issue to repository files...",
        },
        {
            key: "retrieve_fix_memory",
            label: "Check Patterns",
            detail: "Searching previously verified fixes...",
        },
        {
            key: "generate_plan",
            label: "Plan & Audit",
            detail: "Drafting the plan & performing security/compliance checks...",
        },
        {
            key: "waiting_for_plan_approval",
            label: "Awaiting Approval",
            detail: "Plan generated. Waiting for user approval.",
        }
    ];

    const startIndex = run.completedSteps || 0;
    const stepRecords = await Promise.all(
        workflowSteps.map((step, index) =>
            runService.createRunStep({
                runId: run.id,
                taskId,
                order: startIndex + index + 1,
                key: step.key,
                label: step.label,
                status: "pending",
                detail: step.detail,
                phase: "code_fix",
            }),
        ),
    );

    const completeStep = async (index: number, detail: string) => {
        await runService.updateRunStepStatus(stepRecords[index], "completed", detail);
        await runService.updateAgentRunProgress(
            run.id,
            startIndex + index + 1,
            workflowSteps[index + 1]?.detail || "Waiting for plan approval.",
        );
    };

    try {
        await gitlabDuoAdapter.invokeAgent(taskId, "infer_target_files", "code_fixer");
        await runService.updateRunStepStatus(
            stepRecords[0],
            "running",
            "Loading repository tree from GitLab...",
        );

        const visionArtifact = await taskService.getArtifactsByTaskIdAndType(
            taskId,
            "vision_analysis",
        );
        const visionAnalysisResult = parseVisionArtifact(visionArtifact?.content);

        const treeResult = await gitlabRepositoryAdapter.listRepositoryTree(
            task.gitlabProjectId,
            task.branch || task.defaultBranch,
        );
        if (!treeResult.success || !treeResult.data) {
            throw new Error(treeResult.error || "Failed to load repository tree.");
        }

        const repositoryPaths = filterRepositoryPaths(
            treeResult.data
                .filter((entry) => entry.type === "blob")
                .map((entry) => entry.path),
        );
        if (repositoryPaths.length === 0) {
            throw new Error("The configured GitLab repository does not expose candidate source files.");
        }

        await taskService.appendAgentMessage({
            taskId,
            sender: "code_agent",
            content: `Loaded ${repositoryPaths.length} repository files for candidate matching.`,
            kind: "info",
            timestamp: Date.now(),
        });
        void runBackgroundCodeReviewDiscoveryWorkflow({
            repo: task.repo,
            repoName: task.repoName,
            branch: task.branch || task.defaultBranch,
            defaultBranch: task.defaultBranch,
            gitlabProjectId: task.gitlabProjectId,
            gitlabProjectWebUrl: task.gitlabProjectWebUrl,
            triggerTaskId: taskId,
            discoveryMode: "candidate_matching",
            treeEntries: treeResult.data,
        });
        await completeStep(0, "Repository tree loaded.");

        await runService.updateRunStepStatus(
            stepRecords[1],
            "running",
            "Searching stored verification memories...",
        );
        const memory = await memoryService.getRelevantMemoryForTask(taskId);
        const memoryContent = memory?.content;
        if (memory) {
            await memoryService.attachMemoryHitToTask(
                taskId,
                memory.id,
                0.88,
                "Matched against a previously verified live run.",
            );
            await taskService.appendAgentMessage({
                taskId,
                sender: "system",
                content: `Found a relevant memory: "${memory.title}".`,
                kind: "info",
                timestamp: Date.now(),
            });
        }
        await completeStep(1, "Memory retrieval complete.");

        await gitlabDuoAdapter.invokeAgent(
            taskId,
            "generate_fix_recommendation",
            "code_fixer",
        );
        await runService.updateRunStepStatus(
            stepRecords[2],
            "running",
            "Requesting Gemini planning and security audit...",
        );

        const recommendation = await codeAgentAdapter.generateFixRecommendation({
            taskId,
            taskTitle: task.title,
            taskPrompt: task.prompt,
            visionAnalysisResult,
            repoTreePaths: repositoryPaths,
            memoryContent,
        });

        if (recommendation.agentThought) {
            await taskService.appendAgentMessage({
                taskId,
                sender: "code_agent",
                content: recommendation.agentThought,
                kind: "thinking",
                timestamp: Date.now(),
            });
        }

        await taskService.updateTask(taskId, {
            candidateFiles: recommendation.suspectedFiles,
            componentHints: [recommendation.suspectedComponent],
        });
        await completeStep(
            2,
            `Gemini selected ${recommendation.suspectedFiles.length} file(s) and completed security/compliance audit.`,
        );

        await runService.updateRunStepStatus(
            stepRecords[3],
            "running",
            "Waiting for human approval of the plan.",
        );

        // Save the plan as a Draft Patch Proposal
        const proposalId = crypto.randomUUID();
        await patchProposalService.createPatchProposal({
            id: proposalId,
            taskId,
            source: "gemini_code_agent",
            status: "draft",
            title: "Proposed Implementation Plan & Audit Results",
            summary: "Awaiting execution approval.",
            suspectedFiles: recommendation.suspectedFiles,
            recommendedStrategy: recommendation.recommendedFix,
            explanation: recommendation.explanation,
            securityAuditFaults: recommendation.securityAuditFaults,
            complianceChecks: recommendation.complianceChecks,
            confidence: recommendation.confidence,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });

        await taskService.updateTask(taskId, { codeFixStatus: "waiting_for_plan_approval" });
        await taskService.appendAgentMessage({
            taskId,
            sender: "devpilot",
            content: "The implementation plan, security audit, and compliance checks are ready for your review.",
            kind: "success",
            timestamp: Date.now(),
        });
        await completeStep(3, "Ready for plan approval.");
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await taskService.updateTask(taskId, { codeFixStatus: "failed" });
        await taskService.appendAgentMessage({
            taskId,
            sender: "system",
            content: `Planning workflow failed: ${message}`,
            kind: "warning",
            timestamp: Date.now(),
        });
    }
};
