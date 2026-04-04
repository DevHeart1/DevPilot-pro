import {
  ApprovalRequest,
  AuthSessionSnapshot,
  ConnectedIntegration,
  ConnectedIntegrationSource,
  ConnectedIntegrationStatus,
  DelegatedActionPolicy,
  DelegatedActionPreviewInput,
  IntegrationProvider,
  PendingDelegatedAction,
  SecureRuntimeMode,
  SecureRuntimeSnapshot,
  StepUpRequirement,
} from "../../types";

const providerDisplayNames: Record<IntegrationProvider, string> = {
  github: "GitHub",
  gitlab: "GitLab",
  slack: "Slack",
  google: "Google Workspace",
};

const providerDefaultScopes: Record<IntegrationProvider, string[]> = {
  github: ["repo:read", "pull_requests:write", "issues:write"],
  gitlab: ["read_api", "read_repository", "api", "write_repository"],
  slack: ["channels:read", "groups:read", "chat:write"],
  google: ["openid", "profile", "email", "calendar.readonly"],
};

export const delegatedActionPolicies: DelegatedActionPolicy[] = [
  {
    id: "github.read_open_prs",
    actionKey: "github.read_open_prs",
    provider: "github",
    riskLevel: "low",
    requiresApproval: false,
    requiresStepUp: false,
    approvalTrigger: "never",
    stepUpTrigger: "never",
    approvalChannel: "in_app",
    canRunInBackgroundBeforeApproval: true,
    safeToAutoExecute: true,
    allowedScopes: ["repo:read"],
    summary: "Read open pull requests before DevPilot drafts or reviews work.",
  },
  {
    id: "gitlab.read_repo_metadata",
    actionKey: "gitlab.read_repo_metadata",
    provider: "gitlab",
    riskLevel: "low",
    requiresApproval: false,
    requiresStepUp: false,
    approvalTrigger: "never",
    stepUpTrigger: "never",
    approvalChannel: "in_app",
    canRunInBackgroundBeforeApproval: true,
    safeToAutoExecute: true,
    allowedScopes: ["read_api", "read_repository"],
    summary: "Read repository metadata, branches, and merge-request summaries.",
  },
  {
    id: "gitlab.read_open_prs",
    actionKey: "gitlab.read_open_prs",
    provider: "gitlab",
    riskLevel: "low",
    requiresApproval: false,
    requiresStepUp: false,
    approvalTrigger: "never",
    stepUpTrigger: "never",
    approvalChannel: "in_app",
    canRunInBackgroundBeforeApproval: true,
    safeToAutoExecute: true,
    allowedScopes: ["read_api"],
    summary: "Read open merge requests and issue context before planning work.",
  },
  {
    id: "github.read_repo_metadata",
    actionKey: "github.read_repo_metadata",
    provider: "github",
    riskLevel: "low",
    requiresApproval: false,
    requiresStepUp: false,
    approvalTrigger: "never",
    stepUpTrigger: "never",
    approvalChannel: "in_app",
    canRunInBackgroundBeforeApproval: true,
    safeToAutoExecute: true,
    allowedScopes: ["repo:read"],
    summary: "Read repository metadata, pull requests, and issue lists.",
  },
  {
    id: "github.create_draft_issue",
    actionKey: "github.create_draft_issue",
    provider: "github",
    riskLevel: "medium",
    requiresApproval: true,
    requiresStepUp: false,
    approvalTrigger: "write_requires_review",
    stepUpTrigger: "never",
    approvalChannel: "in_app",
    canRunInBackgroundBeforeApproval: false,
    safeToAutoExecute: false,
    approvalTimeoutSeconds: 900,
    approvalReason:
      "Creating a GitHub issue changes external project state and should stay human-approved.",
    allowedScopes: ["issues:write"],
    summary: "Create a draft issue in GitHub for a proposed DevPilot follow-up.",
  },
  {
    id: "slack.read_channel_metadata",
    actionKey: "slack.read_channel_metadata",
    provider: "slack",
    riskLevel: "low",
    requiresApproval: false,
    requiresStepUp: false,
    approvalTrigger: "never",
    stepUpTrigger: "never",
    approvalChannel: "in_app",
    canRunInBackgroundBeforeApproval: true,
    safeToAutoExecute: true,
    allowedScopes: ["channels:read", "groups:read"],
    summary: "Read channel metadata so DevPilot can target the right workspace context.",
  },
  {
    id: "gitlab.comment_on_mr",
    actionKey: "gitlab.comment_on_mr",
    provider: "gitlab",
    riskLevel: "medium",
    requiresApproval: true,
    requiresStepUp: false,
    approvalTrigger: "write_requires_review",
    stepUpTrigger: "never",
    approvalChannel: "in_app",
    canRunInBackgroundBeforeApproval: false,
    safeToAutoExecute: false,
    approvalTimeoutSeconds: 900,
    approvalReason:
      "Posting on an MR can influence teammate review flow and should remain supervised.",
    allowedScopes: ["api"],
    summary: "Post a review-ready note on an existing GitLab merge request.",
  },
  {
    id: "gitlab.create_draft_issue",
    actionKey: "gitlab.create_draft_issue",
    provider: "gitlab",
    riskLevel: "medium",
    requiresApproval: true,
    requiresStepUp: false,
    approvalTrigger: "write_requires_review",
    stepUpTrigger: "never",
    approvalChannel: "in_app",
    canRunInBackgroundBeforeApproval: false,
    safeToAutoExecute: false,
    approvalTimeoutSeconds: 900,
    approvalReason:
      "Creating a GitLab issue changes project state and should remain human-approved.",
    allowedScopes: ["api"],
    summary: "Create a draft issue for a proposed bug fix or follow-up task.",
  },
  {
    id: "github.comment_on_pr",
    actionKey: "github.comment_on_pr",
    provider: "github",
    riskLevel: "medium",
    requiresApproval: true,
    requiresStepUp: false,
    approvalTrigger: "write_requires_review",
    stepUpTrigger: "never",
    approvalChannel: "in_app",
    canRunInBackgroundBeforeApproval: false,
    safeToAutoExecute: false,
    approvalTimeoutSeconds: 900,
    approvalReason:
      "PR comments should remain explicit because they can affect reviewer expectations.",
    allowedScopes: ["pull_requests:write"],
    summary: "Post a review comment or implementation note on a pull request.",
  },
  {
    id: "slack.post_status_message",
    actionKey: "slack.post_status_message",
    provider: "slack",
    riskLevel: "medium",
    requiresApproval: true,
    requiresStepUp: false,
    approvalTrigger: "write_requires_review",
    stepUpTrigger: "never",
    approvalChannel: "in_app",
    canRunInBackgroundBeforeApproval: false,
    safeToAutoExecute: false,
    approvalTimeoutSeconds: 600,
    approvalReason:
      "Slack status posts are visible to teammates and should stay explicitly approved.",
    allowedScopes: ["chat:write"],
    summary: "Post a narrow status update in a targeted engineering channel.",
  },
  {
    id: "slack.post_verification_summary",
    actionKey: "slack.post_verification_summary",
    provider: "slack",
    riskLevel: "medium",
    requiresApproval: true,
    requiresStepUp: false,
    approvalTrigger: "write_requires_review",
    stepUpTrigger: "never",
    approvalChannel: "in_app",
    canRunInBackgroundBeforeApproval: false,
    safeToAutoExecute: false,
    approvalTimeoutSeconds: 600,
    approvalReason:
      "Verification summaries can influence release confidence and should stay human-approved.",
    allowedScopes: ["chat:write"],
    summary: "Post a verification result summary back to the engineering team.",
  },
  {
    id: "slack.post_approval_requested",
    actionKey: "slack.post_approval_requested",
    provider: "slack",
    riskLevel: "medium",
    requiresApproval: true,
    requiresStepUp: false,
    approvalTrigger: "write_requires_review",
    stepUpTrigger: "never",
    approvalChannel: "in_app",
    canRunInBackgroundBeforeApproval: false,
    safeToAutoExecute: false,
    approvalTimeoutSeconds: 600,
    approvalReason:
      "Approval requests are team-visible notifications and should stay explicitly approved.",
    allowedScopes: ["chat:write"],
    summary: "Post an approval-request message when DevPilot is waiting on a sensitive action.",
  },
  {
    id: "gitlab.open_draft_pr",
    actionKey: "gitlab.open_draft_pr",
    provider: "gitlab",
    riskLevel: "high",
    requiresApproval: true,
    requiresStepUp: true,
    approvalTrigger: "high_risk_write",
    stepUpTrigger: "protected_resource",
    approvalChannel: "in_app",
    canRunInBackgroundBeforeApproval: false,
    safeToAutoExecute: false,
    approvalTimeoutSeconds: 300,
    approvalReason:
      "Opening a draft merge request is a high-risk repository write and must pause for approval.",
    stepUpReason:
      "Opening repository change proposals should require stronger user verification before execution.",
    allowedScopes: ["api", "write_repository"],
    summary: "Open a draft merge request containing DevPilot-authored code changes.",
  },
  {
    id: "gitlab.trigger_pipeline_rerun",
    actionKey: "gitlab.trigger_pipeline_rerun",
    provider: "gitlab",
    riskLevel: "high",
    requiresApproval: true,
    requiresStepUp: true,
    approvalTrigger: "high_risk_write",
    stepUpTrigger: "protected_resource",
    approvalChannel: "in_app",
    canRunInBackgroundBeforeApproval: false,
    safeToAutoExecute: false,
    approvalTimeoutSeconds: 300,
    approvalReason:
      "Rerunning pipelines can affect deployment confidence and should require explicit approval.",
    stepUpReason:
      "Pipeline reruns affect protected delivery workflows and should require step-up confirmation.",
    allowedScopes: ["api"],
    summary: "Trigger a pipeline rerun that can affect deployment or release confidence.",
  },
  {
    id: "gitlab.merge_pr",
    actionKey: "gitlab.merge_pr",
    provider: "gitlab",
    riskLevel: "high",
    requiresApproval: true,
    requiresStepUp: true,
    approvalTrigger: "high_risk_write",
    stepUpTrigger: "privileged_write",
    approvalChannel: "in_app",
    canRunInBackgroundBeforeApproval: false,
    safeToAutoExecute: false,
    approvalTimeoutSeconds: 300,
    approvalReason:
      "Merging code is a privileged repository action and must never happen silently.",
    stepUpReason:
      "Merging reviewed code into a protected branch should require stronger user verification.",
    allowedScopes: ["api"],
    summary: "Merge a reviewed merge request into the protected target branch.",
  },
  {
    id: "slack.post_broad_message",
    actionKey: "slack.post_broad_message",
    provider: "slack",
    riskLevel: "high",
    requiresApproval: true,
    requiresStepUp: true,
    approvalTrigger: "channel_broadcast",
    stepUpTrigger: "privileged_write",
    approvalChannel: "in_app",
    canRunInBackgroundBeforeApproval: false,
    safeToAutoExecute: false,
    approvalTimeoutSeconds: 300,
    approvalReason:
      "Broad Slack posts can have wide organizational impact and must pause for review.",
    stepUpReason:
      "Wide-audience communications should require stronger user confirmation before sending.",
    allowedScopes: ["chat:write", "channels:read"],
    summary: "Post a broad or privileged announcement to a wide Slack audience.",
  },
];

const providerOrder: IntegrationProvider[] = [
  "gitlab",
  "github",
  "slack",
  "google",
];

export function getProviderDisplayName(provider: IntegrationProvider): string {
  return providerDisplayNames[provider];
}

export function getDelegatedActionPolicy(
  provider: IntegrationProvider,
  actionKey: string,
): DelegatedActionPolicy | undefined {
  return delegatedActionPolicies.find(
    (policy) => policy.provider === provider && policy.actionKey === actionKey,
  );
}

export function getRelevantProviderScopes(
  provider: IntegrationProvider,
): string[] {
  const scopes = delegatedActionPolicies
    .filter((policy) => policy.provider === provider)
    .flatMap((policy) => policy.allowedScopes);

  return Array.from(
    new Set([...providerDefaultScopes[provider], ...scopes]),
  );
}

export function buildConnectedIntegrations(options: {
  now?: number;
  source: ConnectedIntegrationSource;
  sourceByProvider?: Partial<Record<IntegrationProvider, ConnectedIntegrationSource>>;
  statusByProvider: Partial<
    Record<IntegrationProvider, ConnectedIntegrationStatus>
  >;
  accountIdentifiers?: Partial<Record<IntegrationProvider, string>>;
  connectedAtByProvider?: Partial<Record<IntegrationProvider, number>>;
}): ConnectedIntegration[] {
  const now = options.now ?? Date.now();

  return providerOrder.map((provider) => ({
    id: `integration:${provider}`,
    provider,
    status: options.statusByProvider[provider] ?? "not_connected",
    scopes: getRelevantProviderScopes(provider),
    displayName: getProviderDisplayName(provider),
    accountIdentifier: options.accountIdentifiers?.[provider],
    connectedAt: options.connectedAtByProvider?.[provider],
    updatedAt: now,
    source: options.sourceByProvider?.[provider] ?? options.source,
  }));
}

export function createPendingDelegatedAction(
  input: DelegatedActionPreviewInput,
  policy: DelegatedActionPolicy,
  now: number = Date.now(),
): PendingDelegatedAction {
  const initialStatus = getInitialPendingActionStatus(policy);
  return {
    id: `pending:${crypto.randomUUID()}`,
    taskId: input.taskId,
    provider: input.provider,
    actionKey: input.actionKey,
    title: input.title ?? humanizeActionKey(input.actionKey),
    summary: input.summary ?? policy.summary,
    riskLevel: policy.riskLevel,
    requiredScopes: policy.allowedScopes,
    approvalStatus: policy.requiresApproval ? "pending" : "not_required",
    stepUpStatus: policy.requiresStepUp ? "required" : "not_required",
    status: initialStatus,
    metadata: input.metadata ? JSON.stringify(input.metadata) : undefined,
    createdAt: now,
    updatedAt: now,
  };
}

export function createSessionSnapshot(options: {
  id?: string;
  runtimeMode: SecureRuntimeMode;
  authenticated: boolean;
  isFallback: boolean;
  auth0Configured: boolean;
  liveAuthEnabled: boolean;
  liveDelegatedActionEnabled: boolean;
  liveAsyncAuthorizationEnabled: boolean;
  liveStepUpEnabled: boolean;
  tokenVaultReady: boolean;
  domain?: string;
  audience?: string;
  user?: AuthSessionSnapshot["user"];
  message: string;
  updatedAt?: number;
}): AuthSessionSnapshot {
  const updatedAt = options.updatedAt ?? Date.now();

  return {
    id: options.id ?? `session:${options.runtimeMode}`,
    status: options.authenticated ? "authenticated" : "anonymous",
    runtimeMode: options.runtimeMode,
    isFallback: options.isFallback,
    user: options.user,
    auth0: {
      configured: options.auth0Configured,
      liveAuthEnabled: options.liveAuthEnabled,
      liveDelegatedActionEnabled: options.liveDelegatedActionEnabled,
      liveAsyncAuthorizationEnabled: options.liveAsyncAuthorizationEnabled,
      liveStepUpEnabled: options.liveStepUpEnabled,
      tokenVaultReady: options.tokenVaultReady,
      domain: options.domain,
      audience: options.audience,
    },
    message: options.message,
    updatedAt,
  };
}

export function createMockSecureRuntimeSnapshot(
  now: number = Date.now(),
): SecureRuntimeSnapshot {
  const session = createSessionSnapshot({
    id: "session:mock-local",
    runtimeMode: "mock",
    authenticated: true,
    isFallback: true,
    auth0Configured: false,
    liveAuthEnabled: false,
    liveDelegatedActionEnabled: false,
    tokenVaultReady: false,
    user: {
      sub: "local-devpilot-user",
      name: "Local Developer",
      email: "local@devpilot.invalid",
    },
    message:
      "Secure runtime is unavailable, so DevPilot is using a local mock session with explicit dry-run boundaries.",
    updatedAt: now,
  });

  const integrations = buildConnectedIntegrations({
    now,
    source: "mock",
    statusByProvider: {
      gitlab: "connected",
      github: "not_connected",
      slack: "expired",
      google: "connected",
    },
    accountIdentifiers: {
      gitlab: "devpilot/sandbox-workspace",
      google: "local.operator@devpilot.invalid",
    },
    connectedAtByProvider: {
      gitlab: now - 1000 * 60 * 60 * 24 * 2,
      google: now - 1000 * 60 * 60 * 12,
    },
  });

  const previewOne = createPendingDelegatedAction(
    {
      provider: "gitlab",
      actionKey: "gitlab.read_repo_metadata",
      title: "Read repository metadata",
      summary:
        "Low-risk read for project branches and MR context before planning a task.",
    },
    getDelegatedActionPolicy("gitlab", "gitlab.read_repo_metadata")!,
    now - 1000 * 60 * 18,
  );
  const previewTwo = createPendingDelegatedAction(
    {
      provider: "gitlab",
      actionKey: "gitlab.open_draft_pr",
      title: "Open draft merge request",
      summary:
        "High-risk write path that still requires approval and step-up before execution.",
    },
    getDelegatedActionPolicy("gitlab", "gitlab.open_draft_pr")!,
    now - 1000 * 60 * 6,
  );

  return {
    session,
    integrations,
    policies: delegatedActionPolicies,
    approvalRequests: [] as ApprovalRequest[],
    stepUpRequirements: [] as StepUpRequirement[],
    executions: [],
    pendingActions: [
      previewTwo,
      {
        ...previewOne,
        id: `pending:${crypto.randomUUID()}`,
      },
    ].sort((left, right) => right.updatedAt - left.updatedAt),
    runtimeMode: "mock",
    warnings: [
      "Secure runtime could not be reached. DevPilot is showing local mock integrations and dry-run delegated action previews.",
    ],
    updatedAt: now,
  };
}

function getInitialPendingActionStatus(
  policy: DelegatedActionPolicy,
): PendingDelegatedAction["status"] {
  if (policy.requiresApproval) {
    return "awaiting_approval";
  }

  if (policy.requiresStepUp) {
    return "awaiting_step_up";
  }

  return "proposed";
}

function humanizeActionKey(actionKey: string): string {
  return actionKey
    .split(".")
    .slice(1)
    .join(" ")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
