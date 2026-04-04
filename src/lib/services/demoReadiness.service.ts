import {
  AuthSessionSnapshot,
  ConnectedIntegration,
  DelegatedActionPolicy,
  GitLabProjectSummary,
} from "../../types";
import { DemoScenarioKind } from "./demoScenario.service";

export type DemoCheckStatus = "ready" | "fallback" | "blocked";

export interface DemoReadinessCheck {
  id: string;
  label: string;
  status: DemoCheckStatus;
  summary: string;
}

export interface DemoReadinessReport {
  status: DemoCheckStatus;
  recommendedScenario: DemoScenarioKind;
  headline: string;
  summary: string;
  canLaunchDemo: boolean;
  checks: DemoReadinessCheck[];
}

export interface DemoReadinessInput {
  project?: GitLabProjectSummary;
  targetAppBaseUrl?: string;
  authSession?: AuthSessionSnapshot;
  integrations: ConnectedIntegration[];
  policies: DelegatedActionPolicy[];
  warnings: string[];
  gitlabRepositoryModeReady: boolean;
  sandboxConfigured: boolean;
}

export const demoReadinessService = {
  evaluate(input: DemoReadinessInput): DemoReadinessReport {
    const gitlabIntegration = input.integrations.find(
      (integration) => integration.provider === "gitlab",
    );
    const slackIntegration = input.integrations.find(
      (integration) => integration.provider === "slack",
    );
    const approvalPolicies = input.policies.filter((policy) => policy.requiresApproval);
    const highRiskPolicies = input.policies.filter((policy) => policy.riskLevel === "high");

    const checks: DemoReadinessCheck[] = [
      {
        id: "target_surface",
        label: "Target surface",
        status: input.targetAppBaseUrl ? "ready" : "blocked",
        summary: input.targetAppBaseUrl
          ? `Showcase target is set to ${input.targetAppBaseUrl}.`
          : "Set a target app URL so the showcase task has a concrete runtime surface.",
      },
      {
        id: "repo_context",
        label: "Repo context",
        status: input.project ? "ready" : "fallback",
        summary: input.project
          ? `${input.project.name} is selected for the showcase path.`
          : "No repo is selected, so DevPilot will use a local showcase context instead of a live branch staging path.",
      },
      {
        id: "secure_runtime",
        label: "Secure runtime",
        status:
          input.authSession?.auth0.tokenVaultReady
            ? "ready"
            : input.authSession
              ? "fallback"
              : "blocked",
        summary:
          input.authSession?.auth0.tokenVaultReady
            ? "Auth0 secure runtime is ready for delegated provider access."
            : input.authSession
              ? "Secure runtime is available, but the demo may rely on fallback-secure approval or provider paths."
              : "No secure runtime session is available yet.",
      },
      {
        id: "repo_write_path",
        label: "Repo write path",
        status:
          input.gitlabRepositoryModeReady && gitlabIntegration?.status === "connected"
            ? "ready"
            : gitlabIntegration?.status === "connected"
              ? "fallback"
              : "blocked",
        summary:
          input.gitlabRepositoryModeReady && gitlabIntegration?.status === "connected"
            ? integrationSourceSummary(gitlabIntegration)
            : gitlabIntegration?.status === "connected"
              ? "GitLab delegated access is available, but live branch staging is not fully configured. DevPilot will switch to a safer fallback showcase path."
              : "GitLab delegated access is not connected, so repo write execution will stop safely after the approval boundary.",
      },
      {
        id: "slack_path",
        label: "Team notification path",
        status: slackIntegration?.status === "connected" ? "ready" : "fallback",
        summary:
          slackIntegration?.status === "connected"
            ? integrationSourceSummary(slackIntegration)
            : "Slack is optional for the demo. If it is unavailable, DevPilot will explain that the team update was skipped safely.",
      },
      {
        id: "approval_boundary",
        label: "Approval boundary",
        status:
          approvalPolicies.length > 0 && highRiskPolicies.length > 0
            ? "ready"
            : "fallback",
        summary:
          approvalPolicies.length > 0 && highRiskPolicies.length > 0
            ? `${approvalPolicies.length} actions require approval, including ${highRiskPolicies.length} high-risk paths.`
            : "Approval policies are present, but the strongest high-risk secure handoff may not be available in this runtime.",
      },
      {
        id: "sandbox",
        label: "Sandbox signal",
        status: input.sandboxConfigured ? "ready" : "fallback",
        summary: input.sandboxConfigured
          ? "Sandbox runtime is configured for the showcase task."
          : "Sandbox is not configured, so the demo will rely on captured evidence instead of a live runtime panel.",
      },
    ];

    const repoWriteCheck = checks.find((check) => check.id === "repo_write_path");
    const slackCheck = checks.find((check) => check.id === "slack_path");
    const targetCheck = checks.find((check) => check.id === "target_surface");

    const recommendedScenario: DemoScenarioKind =
      targetCheck?.status === "blocked"
        ? "blocked_provider"
        : repoWriteCheck?.status === "ready" && slackCheck?.status === "ready"
          ? "golden_path"
          : repoWriteCheck?.status === "blocked"
            ? "blocked_provider"
            : "fallback_path";

    const status =
      recommendedScenario === "golden_path"
        ? "ready"
        : recommendedScenario === "fallback_path"
          ? "fallback"
          : "blocked";

    return {
      status,
      recommendedScenario,
      canLaunchDemo: Boolean(input.targetAppBaseUrl),
      headline:
        recommendedScenario === "golden_path"
          ? "Golden secure demo ready"
          : recommendedScenario === "fallback_path"
            ? "Fallback-secure demo ready"
            : "Blocked-path demo ready",
      summary:
        recommendedScenario === "golden_path"
          ? "DevPilot can demonstrate the full secure handoff: review-ready patch, approval before repo write, server-side execution, Slack follow-up, and verification."
          : recommendedScenario === "fallback_path"
            ? "DevPilot can still demonstrate explicit approval, secure backend execution, and honest fallback messaging even if one live path is degraded."
            : "DevPilot can demonstrate supervised failure clearly: the action is proposed, explained, and blocked safely until the missing provider path is fixed.",
      checks,
    };
  },
};

function integrationSourceSummary(integration: ConnectedIntegration): string {
  const source =
    integration.source === "auth0_token_vault"
      ? "connected via Auth0 Token Vault."
      : integration.source === "secure_backend_fallback"
        ? "connected through a secure backend fallback."
        : "running in mock fallback mode.";

  return `${integration.displayName} is ${source}`;
}
