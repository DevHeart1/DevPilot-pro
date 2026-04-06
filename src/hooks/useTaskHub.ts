import { useState, useEffect, useCallback, useMemo } from "react";
import { sandboxAdapter } from "../lib/adapters/sandbox.adapter";
import { gitlabRepositoryAdapter } from "../lib/adapters/gitlabRepository.adapter";
import { gitlabDuoAdapter } from "../lib/adapters/gitlabDuo.adapter";
import { secureActionAdapter } from "../lib/adapters/secureAction.adapter";
import { useAuth0 } from "@auth0/auth0-react";
import { config } from "../lib/config/env";
import { initializeDb } from "../lib/seeds";
import {
    authorizationInsightService,
    codeReviewIssueService,
    demoReadinessService,
    secureActionService,
    taskService,
    runService,
} from "../lib/services";
import { devpilotFlow } from "../lib/gitlab-duo/flows/devpilot.flow";
import { runBackgroundCodeReviewDiscoveryWorkflow } from "../lib/workflows/backgroundCodeReviewDiscovery.workflow";
import { continueSecureActionDemoWorkflow } from "../lib/workflows/secureActionDemo.workflow";
import { launchHackathonDemoWorkflow } from "../lib/workflows/hackathonDemo.workflow";
import {
    ApprovalRequest,
    ApprovalRequestTransitionResult,
    AuthSessionSnapshot,
    AuthorizationAuditEvent,
    AuthorizationInsight,
    AuthorizationPatternSummary,
    ConnectedIntegration,
    DelegatedActionExecution,
    DelegatedActionPolicy,
    DelegatedActionPreviewInput,
    GitLabBranchSummary,
    GitLabProjectSummary,
    PendingDelegatedAction,
    SecureActionExecutionResult,
    SecureRuntimeMode,
    StepUpRequirement,
    StepUpRequirementTransitionResult,
    Task,
} from "../types";
import { DemoReadinessReport } from "../lib/services/demoReadiness.service";

export interface UserConfig {
    targetAppBaseUrl: string;
    gitlabDefaultBranch: string;
}

export interface IntegrationState {
    loading: boolean;
    ready: boolean;
    issues: string[];
    project?: GitLabProjectSummary;
    branches: GitLabBranchSummary[];
    availableProjects: GitLabProjectSummary[];
}

export interface SecureRuntimeState {
    loading: boolean;
    session?: AuthSessionSnapshot;
    integrations: ConnectedIntegration[];
    policies: DelegatedActionPolicy[];
    pendingActions: PendingDelegatedAction[];
    executions: DelegatedActionExecution[];
    approvalRequests: ApprovalRequest[];
    stepUpRequirements: StepUpRequirement[];
    authorizationAuditEvents: AuthorizationAuditEvent[];
    authorizationInsights: AuthorizationInsight[];
    authorizationPatternSummary: AuthorizationPatternSummary;
    runtimeMode: SecureRuntimeMode;
    warnings: string[];
    updatedAt?: number;
}

const CONFIG_STORAGE_KEY = "devpilot_user_config";

interface TaskSeed {
    title: string;
    prompt: string;
    repo: string;
    repoName?: string;
    branch: string;
    defaultBranch?: string;
    gitlabProjectId?: string;
    gitlabProjectWebUrl?: string;
    candidateFiles?: string[];
    componentHints?: string[];
    sourceIssueId?: string;
    sourceLabel?: string;
}

export const useTaskHub = () => {
    const {
        isAuthenticated,
        user,
        isLoading: authLoading,
        loginWithRedirect,
        logout: auth0Logout,
    } = useAuth0();
    const [integrationState, setIntegrationState] = useState<IntegrationState>({
        loading: true,
        ready: false,
        issues: [],
        branches: [],
        availableProjects: [],
    });
    const [selectedProjectId, setSelectedProjectId] = useState<string | number>(config.gitlabProjectId || "");
    const [selectedBranch, setSelectedBranch] = useState("");
    const [isCreatingTask, setIsCreatingTask] = useState(false);
    const [dashboardError, setDashboardError] = useState<string | null>(null);
    const [secureRuntimeState, setSecureRuntimeState] = useState<SecureRuntimeState>({
        loading: true,
        integrations: [],
        policies: [],
        pendingActions: [],
        executions: [],
        approvalRequests: [],
        stepUpRequirements: [],
        authorizationAuditEvents: [],
        authorizationInsights: [],
        authorizationPatternSummary: {
            generatedAt: 0,
            autoAllowedCount: 0,
            fallbackCount: 0,
            blockedCount: 0,
            approvalRequiredCount: 0,
            highRiskPolicyCount: 0,
            blockedProviders: [],
        },
        runtimeMode: "mock",
        warnings: [],
    });
    const [userConfig, setUserConfig] = useState<UserConfig>(() => {
        const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch (e) {
                console.error("Failed to parse user config", e);
            }
        }
        return {
            targetAppBaseUrl: config.targetAppBaseUrl || "",
            gitlabDefaultBranch: config.gitlabDefaultBranch || "main",
        };
    });

    const demoReadiness = useMemo<DemoReadinessReport>(() =>
        demoReadinessService.evaluate({
            project: integrationState.project,
            targetAppBaseUrl: userConfig.targetAppBaseUrl || config.targetAppBaseUrl,
            authSession: secureRuntimeState.session,
            integrations: secureRuntimeState.integrations,
            policies: secureRuntimeState.policies,
            warnings: secureRuntimeState.warnings,
            gitlabRepositoryModeReady: config.isGitLabConfigured && Boolean(integrationState.project),
            sandboxConfigured: config.isSandboxConfigured,
        }),
    [
        integrationState.project,
        userConfig.targetAppBaseUrl,
        secureRuntimeState.session,
        secureRuntimeState.integrations,
        secureRuntimeState.policies,
        secureRuntimeState.warnings,
    ]);

    useEffect(() => {
        localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(userConfig));
    }, [userConfig]);

    const loadIntegrationState = useCallback(async () => {
        setIntegrationState((current) => ({ ...current, loading: true, issues: [] }));
        await initializeDb();

        const issues: string[] = [];
        let project: GitLabProjectSummary | undefined;
        let branches: GitLabBranchSummary[] = [];

        if (!config.isGitLabConfigured) {
            issues.push("GitLab token is not configured. Set VITE_LIVE_REPOSITORY_MODE=true and VITE_GITLAB_TOKEN.");
        }

        if (!config.isGeminiConfigured) {
            issues.push("Gemini is not configured. Set VITE_LIVE_MODE=true and VITE_GEMINI_API_KEY.");
        }

        if (!config.isSandboxConfigured) {
            issues.push("Sandbox URL is not configured. Set VITE_SANDBOX_URL.");
        }

        if (config.isSandboxConfigured) {
            try {
                const sandboxHealthy = await sandboxAdapter.checkHealth();
                if (!sandboxHealthy) {
                    issues.push(`Sandbox health check failed at ${config.sandboxUrl}. Start devpilot-sandbox before running tasks.`);
                }
            } catch (error) {
                issues.push(`Sandbox is unreachable at ${config.sandboxUrl}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }

        if (!userConfig.targetAppBaseUrl) {
            issues.push("Target application URL is not configured. Set it in Settings.");
        }

        let availableProjects: GitLabProjectSummary[] = [];

        if (config.isGitLabConfigured) {
            const projectsResult = await gitlabRepositoryAdapter.listProjects();
            if (projectsResult.success && projectsResult.data) {
                availableProjects = projectsResult.data;
                const currentId = selectedProjectId || config.gitlabProjectId || availableProjects[0]?.id;

                if (currentId) {
                    const [projectResult, branchResult] = await Promise.all([
                        gitlabRepositoryAdapter.getProject(String(currentId)),
                        gitlabRepositoryAdapter.listBranches(String(currentId)),
                    ]);

                    if (projectResult.success && projectResult.data) {
                        project = projectResult.data;
                        if (!selectedProjectId) setSelectedProjectId(project.id);
                    }
                    if (branchResult.success && branchResult.data) {
                        branches = branchResult.data;
                    }
                }
            } else {
                issues.push(projectsResult.error || "Failed to load GitLab projects.");
            }
        }

        if (config.isGitLabConfigured && !project) {
            issues.push("No GitLab project selected. Please choose a project from the dropdown.");
        }

        setIntegrationState({
            loading: false,
            ready: issues.length === 0 && !!project && branches.length > 0 && !!userConfig.targetAppBaseUrl,
            issues,
            project,
            branches,
            availableProjects,
        });
    }, [selectedProjectId, userConfig.targetAppBaseUrl]);

    const loadSecureRuntimeState = useCallback(async () => {
        setSecureRuntimeState((current) => ({ ...current, loading: true }));
        await initializeDb();

        const snapshot = await secureActionService.refreshRuntimeSnapshot();
        const authorizationInsights = await authorizationInsightService.getInsights();
        const authorizationPatternSummary =
            authorizationInsightService.buildPatternSummary(snapshot);

        setSecureRuntimeState({
            loading: false,
            session: snapshot.session,
            integrations: snapshot.integrations,
            policies: snapshot.policies,
            pendingActions: snapshot.pendingActions,
            executions: snapshot.executions,
            approvalRequests: snapshot.approvalRequests,
            stepUpRequirements: snapshot.stepUpRequirements,
            authorizationAuditEvents: snapshot.authorizationAuditEvents,
            authorizationInsights,
            authorizationPatternSummary,
            runtimeMode: snapshot.runtimeMode,
            warnings: snapshot.warnings,
            updatedAt: snapshot.updatedAt,
        });
    }, []);

    // Sync Auth0 SDK state to secure runtime state
    useEffect(() => {
        if (!config.liveAuthMode) return;

        if (isAuthenticated && user) {
            setSecureRuntimeState((current) => ({
                ...current,
                loading: current.loading || authLoading,
                session: {
                    id: `session:${user.sub}`,
                    status: "authenticated",
                    runtimeMode: current.runtimeMode,
                    isFallback: false,
                    user: {
                        sub: user.sub || "",
                        name: user.name || "",
                        email: user.email,
                        pictureUrl: user.picture,
                    },
                    auth0: {
                        configured: true,
                        liveAuthEnabled: true,
                        liveDelegatedActionEnabled: config.liveDelegatedActionMode,
                        liveAsyncAuthorizationEnabled: config.liveAsyncAuthorizationMode,
                        liveStepUpEnabled: config.liveStepUpMode,
                        tokenVaultReady: true,
                        domain: config.auth0Domain,
                        audience: config.auth0Audience,
                    },
                    message: "Identity verified via Auth0 SDK",
                    updatedAt: Date.now(),
                },
            }));
        }
    }, [isAuthenticated, user, authLoading]);

    // Refresh secure runtime (BFF) when authentication status changes
    useEffect(() => {
        if (isAuthenticated) {
            void loadSecureRuntimeState();
        }
    }, [isAuthenticated, loadSecureRuntimeState]);

    const handleProjectChange = async (projectId: string | number) => {
        setSelectedProjectId(projectId);
        setIntegrationState(prev => ({ ...prev, loading: true }));

        const [projectResult, branchResult] = await Promise.all([
            gitlabRepositoryAdapter.getProject(String(projectId)),
            gitlabRepositoryAdapter.listBranches(String(projectId)),
        ]);

        setIntegrationState(prev => {
            const newIssues = prev.issues.filter(i => !i.includes("project"));
            const ready = newIssues.length === 0 && !!projectResult.data && !!branchResult.data;

            return {
                ...prev,
                loading: false,
                ready,
                issues: newIssues,
                project: projectResult.data || prev.project,
                branches: branchResult.data || [],
            };
        });
    };

    useEffect(() => {
        void loadIntegrationState();
    }, [loadIntegrationState]);

    useEffect(() => {
        void loadSecureRuntimeState();
    }, [loadSecureRuntimeState]);

    useEffect(() => {
        if (!integrationState.project) {
            setSelectedBranch("");
            return;
        }

        setSelectedBranch((currentBranch) => {
            if (currentBranch && integrationState.branches.some((branch) => branch.name === currentBranch)) {
                return currentBranch;
            }
            return (
                integrationState.branches.find((branch) => branch.isDefault)?.name ||
                integrationState.project?.defaultBranch ||
                integrationState.branches[0]?.name ||
                ""
            );
        });
    }, [integrationState.branches, integrationState.project]);

    const createTaskFromSeed = useCallback(async (seed: TaskSeed) => {
        setDashboardError(null);
        setIsCreatingTask(true);

        const now = Date.now();
        const taskId = crypto.randomUUID();
        const matchingProject = integrationState.availableProjects.find(
            (project) => project.pathWithNamespace === seed.repo,
        );
        const resolvedProjectId =
            seed.gitlabProjectId ||
            (matchingProject ? String(matchingProject.id) : undefined) ||
            (integrationState.project?.pathWithNamespace === seed.repo
                ? String(integrationState.project.id)
                : undefined);
        const resolvedDefaultBranch =
            seed.defaultBranch ||
            (matchingProject ? matchingProject.defaultBranch : undefined) ||
            integrationState.project?.defaultBranch ||
            userConfig.gitlabDefaultBranch;
        const resolvedRepoName =
            seed.repoName ||
            matchingProject?.name ||
            integrationState.project?.name ||
            seed.repo.split("/").pop() ||
            seed.repo;
        const resolvedProjectWebUrl =
            seed.gitlabProjectWebUrl ||
            (integrationState.project?.pathWithNamespace === seed.repo
                ? integrationState.project.webUrl
                : undefined);
        const resolvedTargetUrl = userConfig.targetAppBaseUrl || config.targetAppBaseUrl;

        if (!resolvedProjectId) {
            setDashboardError(`Unable to resolve the GitLab project for ${seed.repo}.`);
            setIsCreatingTask(false);
            return null;
        }

        try {
            await taskService.createTask({
                id: taskId,
                title: seed.title,
                prompt: seed.prompt.trim(),
                repo: seed.repo,
                repoName: resolvedRepoName,
                repoPath: seed.repo,
                branch: seed.branch,
                baseBranch: seed.branch,
                targetBranch: userConfig.gitlabDefaultBranch,
                defaultBranch: resolvedDefaultBranch,
                gitlabProjectId: resolvedProjectId,
                gitlabProjectWebUrl: resolvedProjectWebUrl,
                status: "running",
                category: "tasks",
                createdAt: now,
                updatedAt: now,
                plusCount: 0,
                minusCount: 0,
                targetUrl: resolvedTargetUrl,
                sandboxUrl: config.sandboxUrl,
                viewportPreset: "desktop",
                inspectionStatus: "idle",
                codeFixStatus: "idle",
                candidateFiles: seed.candidateFiles,
                componentHints: seed.componentHints,
            });

            await runService.createAgentRun({
                id: crypto.randomUUID(),
                taskId,
                status: "running",
                currentStep: "Waiting to start UI inspection...",
                startedAt: now,
                updatedAt: now,
                progress: 0,
                totalSteps: 19,
                completedSteps: 0,
                mode: "live",
                phase: "inspection",
            });

            await gitlabDuoAdapter.initializeFlowRun(taskId, devpilotFlow.id);
            const originLine = seed.sourceLabel
                ? `Origin: ${seed.sourceLabel}${seed.sourceIssueId ? ` (${seed.sourceIssueId})` : ""}\n`
                : "";
            await taskService.appendAgentMessage({
                taskId,
                sender: "system",
                content:
                    `Created live task for ${seed.repo}@${seed.branch}.\n` +
                    originLine +
                    `Sandbox URL: ${config.sandboxUrl}\n` +
                    `Configured App URL: ${resolvedTargetUrl}`,
                kind: "info",
                timestamp: now,
            });

            return taskId;
        } catch (error) {
            setDashboardError(error instanceof Error ? error.message : String(error));
            return null;
        } finally {
            setIsCreatingTask(false);
        }
    }, [
        integrationState.availableProjects,
        integrationState.project,
        userConfig.gitlabDefaultBranch,
        userConfig.targetAppBaseUrl,
    ]);

    const createTask = async (prompt: string) => {
        if (!integrationState.ready || !integrationState.project || !selectedBranch) return null;

        return await createTaskFromSeed({
            title: prompt.slice(0, 50) + (prompt.length > 50 ? "..." : ""),
            prompt,
            repo: integrationState.project.pathWithNamespace,
            repoName: integrationState.project.name,
            branch: selectedBranch,
            defaultBranch: integrationState.project.defaultBranch,
            gitlabProjectId: String(integrationState.project.id),
            gitlabProjectWebUrl: integrationState.project.webUrl,
        });
    };

    const startCodeReviewIssue = useCallback(async (issueId: string) => {
        setDashboardError(null);
        const issue = await codeReviewIssueService.getIssueById(issueId);
        if (!issue) {
            setDashboardError("That code review issue could not be found.");
            return null;
        }

        if (issue.linkedTaskId) {
            const existingTask = await taskService.getTaskById(issue.linkedTaskId);
            if (existingTask) {
                await codeReviewIssueService.markIssueStarted(issue.id, existingTask.id);
                return existingTask.id;
            }
        }

        const taskId = await createTaskFromSeed({
            title: issue.title,
            prompt: issue.suggestedPrompt,
            repo: issue.repo,
            repoName: issue.repoName,
            branch: issue.branch,
            defaultBranch: issue.defaultBranch,
            gitlabProjectId: issue.gitlabProjectId,
            gitlabProjectWebUrl: issue.gitlabProjectWebUrl,
            candidateFiles: issue.relatedFiles,
            componentHints: [issue.category],
            sourceIssueId: issue.id,
            sourceLabel: `Background ${issue.category.replace("_", " ")} review`,
        });

        if (taskId) {
            await codeReviewIssueService.markIssueStarted(issue.id, taskId);
        }

        return taskId;
    }, [createTaskFromSeed]);

    const previewDelegatedAction = useCallback(async (input: DelegatedActionPreviewInput) => {
        try {
            setDashboardError(null);
            const pendingAction = await secureActionService.previewDelegatedAction(input);
            await loadSecureRuntimeState();
            return pendingAction;
        } catch (error) {
            setDashboardError(error instanceof Error ? error.message : String(error));
            return null;
        }
    }, [loadSecureRuntimeState]);

    const approveApprovalRequest = useCallback(async (
        id: string,
    ): Promise<ApprovalRequestTransitionResult | null> => {
        try {
            setDashboardError(null);
            const result = await secureActionService.approveApprovalRequest(id);
            await loadSecureRuntimeState();
            return result;
        } catch (error) {
            setDashboardError(error instanceof Error ? error.message : String(error));
            return null;
        }
    }, [loadSecureRuntimeState]);

    const rejectApprovalRequest = useCallback(async (
        id: string,
    ): Promise<ApprovalRequestTransitionResult | null> => {
        try {
            setDashboardError(null);
            const result = await secureActionService.rejectApprovalRequest(id);
            await loadSecureRuntimeState();
            return result;
        } catch (error) {
            setDashboardError(error instanceof Error ? error.message : String(error));
            return null;
        }
    }, [loadSecureRuntimeState]);

    const startStepUpRequirement = useCallback(async (
        id: string,
    ): Promise<StepUpRequirementTransitionResult | null> => {
        try {
            setDashboardError(null);
            const result = await secureActionService.startStepUpRequirement(id);
            await loadSecureRuntimeState();
            return result;
        } catch (error) {
            setDashboardError(error instanceof Error ? error.message : String(error));
            return null;
        }
    }, [loadSecureRuntimeState]);

    const completeStepUpRequirement = useCallback(async (
        id: string,
    ): Promise<StepUpRequirementTransitionResult | null> => {
        try {
            setDashboardError(null);
            const result = await secureActionService.completeStepUpRequirement(id);
            await loadSecureRuntimeState();
            return result;
        } catch (error) {
            setDashboardError(error instanceof Error ? error.message : String(error));
            return null;
        }
    }, [loadSecureRuntimeState]);

    const executePendingAction = useCallback(async (id: string): Promise<SecureActionExecutionResult | null> => {
        try {
            setDashboardError(null);
            const result = await secureActionService.executePendingAction(id);
            await continueSecureActionDemoWorkflow(result);
            await loadSecureRuntimeState();
            return result;
        } catch (error) {
            setDashboardError(error instanceof Error ? error.message : String(error));
            return null;
        }
    }, [loadSecureRuntimeState]);

    const triggerDelegatedAction = useCallback(async (
        input: DelegatedActionPreviewInput,
        options?: { executeImmediatelyWhenSafe?: boolean },
    ) => {
        const pendingAction = await previewDelegatedAction(input);
        if (!pendingAction) {
            return null;
        }

        if (
            options?.executeImmediatelyWhenSafe &&
            pendingAction.approvalStatus === "not_required" &&
            pendingAction.stepUpStatus === "not_required"
        ) {
            return await executePendingAction(pendingAction.id);
        }

        return pendingAction;
    }, [executePendingAction, previewDelegatedAction]);

    const launchHackathonDemo = useCallback(async (): Promise<string | null> => {
        try {
            setDashboardError(null);
            await initializeDb();

            const targetAppBaseUrl =
                userConfig.targetAppBaseUrl || config.targetAppBaseUrl;
            if (!targetAppBaseUrl) {
                setDashboardError("Set a target application URL before launching the showcase demo.");
                return null;
            }

            const branch =
                selectedBranch ||
                integrationState.project?.defaultBranch ||
                userConfig.gitlabDefaultBranch ||
                "main";

            const taskId = await launchHackathonDemoWorkflow({
                scenario: demoReadiness.recommendedScenario,
                project: integrationState.project,
                branch,
                targetAppBaseUrl,
            });

            await loadSecureRuntimeState();
            return taskId;
        } catch (error) {
            setDashboardError(error instanceof Error ? error.message : String(error));
            return null;
        }
    }, [
        demoReadiness.recommendedScenario,
        integrationState.project,
        loadSecureRuntimeState,
        selectedBranch,
        userConfig.gitlabDefaultBranch,
        userConfig.targetAppBaseUrl,
    ]);

    const beginLogin = useCallback((returnTo: string = "/settings") => {
        if (config.liveAuthMode) {
            loginWithRedirect({
                appState: { returnTo }
            });
        } else {
            secureActionAdapter.beginLogin(returnTo);
        }
    }, [loginWithRedirect]);

    const beginLogout = useCallback((returnTo: string = "/settings") => {
        if (config.liveAuthMode) {
            auth0Logout({ 
                logoutParams: { 
                    returnTo: window.location.origin + returnTo 
                } 
            });
        } else {
            secureActionAdapter.beginLogout(returnTo);
        }
    }, [auth0Logout]);

    useEffect(() => {
        if (!integrationState.project || !selectedBranch) {
            return;
        }

        void runBackgroundCodeReviewDiscoveryWorkflow({
            repo: integrationState.project.pathWithNamespace,
            repoName: integrationState.project.name,
            branch: selectedBranch,
            defaultBranch: integrationState.project.defaultBranch,
            gitlabProjectId: String(integrationState.project.id),
            gitlabProjectWebUrl: integrationState.project.webUrl,
            discoveryMode: "dashboard_repo_context",
        });
    }, [integrationState.project, selectedBranch]);

    return {
        integrationState,
        secureRuntimeState,
        selectedBranch,
        setSelectedBranch,
        isCreatingTask,
        dashboardError,
        userConfig,
        setUserConfig,
        createTask,
        startCodeReviewIssue,
        handleProjectChange,
        refreshIntegration: loadIntegrationState,
        refreshSecureRuntime: loadSecureRuntimeState,
        demoReadiness,
        launchHackathonDemo,
        previewDelegatedAction,
        triggerDelegatedAction,
        approveApprovalRequest,
        rejectApprovalRequest,
        startStepUpRequirement,
        completeStepUpRequirement,
        executePendingAction,
        beginLogin,
        beginLogout,
    };
};
