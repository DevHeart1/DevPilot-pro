import { AgentMessage, CodeReviewIssueSeverity, GitLabProjectSummary } from "../../types";

export type DemoScenarioKind =
  | "golden_path"
  | "fallback_path"
  | "blocked_provider";

export interface HackathonDemoSeedInput {
  scenario: DemoScenarioKind;
  project?: GitLabProjectSummary;
  branch: string;
  targetAppBaseUrl: string;
}

export interface HackathonDemoSeed {
  scenario: DemoScenarioKind;
  repo: string;
  repoName: string;
  branch: string;
  defaultBranch: string;
  gitlabProjectId?: string;
  gitlabProjectWebUrl?: string;
  taskTitle: string;
  taskPrompt: string;
  sourceLabel: string;
  issue: {
    title: string;
    summary: string;
    category: "ui";
    severity: CodeReviewIssueSeverity;
    confidence: number;
    score: number;
    easeOfFix: number;
    impactBreadth: number;
    relatedFiles: string[];
    evidence: string[];
    suggestedPrompt: string;
    dedupeKey: string;
  };
  candidateFiles: string[];
  componentHints: string[];
  proposal: {
    title: string;
    summary: string;
    explanation: string;
    recommendedStrategy: string;
    confidence: number;
    suspectedFiles: string[];
  };
  patchFiles: Array<{
    filePath: string;
    changeType: "create";
    patch: string;
    nextContent: string;
    explanation: string;
  }>;
  verificationPlan: {
    expectedOutcome: string;
    checks: string[];
  };
  artifacts: {
    screenshot: string;
    terminal: string;
    visionAnalysis: string;
  };
  run: {
    currentStep: string;
    progress: number;
    totalSteps: number;
    completedSteps: number;
    phase: "code_fix";
  };
  initialMessages: Array<Omit<AgentMessage, "id" | "taskId" | "timestamp">>;
}

export const demoScenarioService = {
  buildSeed(input: HackathonDemoSeedInput): HackathonDemoSeed {
    const repo = input.project?.pathWithNamespace ?? "devpilot/secure-demo";
    const repoName = input.project?.name ?? "Secure Demo Repo";
    const defaultBranch = input.project?.defaultBranch ?? "main";
    const gitlabProjectId = input.project ? String(input.project.id) : undefined;
    const issueTitle = "Tighten secure approval cards for narrow desktop and tablet";
    const issueSummary =
      "Background review flagged a layout regression where approval context, risk chips, and provider cues become harder to scan on narrower workspaces.";
    const taskTitle =
      input.scenario === "golden_path"
        ? "Secure AI handoff showcase: approval before repo write"
        : input.scenario === "fallback_path"
          ? "Secure fallback showcase: supervised repo action with graceful degradation"
          : "Blocked-provider showcase: supervised action stops safely";
    const taskPrompt =
      input.scenario === "golden_path"
        ? `Review the secure approval experience in ${repo}@${input.branch}. Keep the premium layout intact, prepare a review-ready patch, and use the supervised handoff flow for the repo write.`
        : input.scenario === "fallback_path"
          ? `Prepare a demo-safe fallback story in ${repo}@${input.branch}. Keep the secure approval experience clear even when live repo staging or Slack delivery is partially unavailable.`
          : `Prepare a blocked-action showcase in ${repo}@${input.branch}. The goal is to show that DevPilot requests approval, explains the boundary, and stops safely when provider access is unavailable.`;
    const proposalSummary =
      input.scenario === "golden_path"
        ? "Keeps the secure approval cards readable across narrower workspace widths while preserving the existing premium visual treatment."
        : input.scenario === "fallback_path"
          ? "Clarifies the fallback-secure narrative so the demo still reads cleanly when one provider path is degraded."
          : "Makes the blocked delegated-action path unmistakable so judges can see controlled failure instead of opaque behavior.";
    const proposalExplanation = [
      "DevPilot isolated the most visible friction in the secure handoff experience: the user can lose context when risk, provider, and next-step cues wrap awkwardly under tighter widths.",
      input.scenario === "golden_path"
        ? "The proposal keeps the approval checkpoint central, reinforces the provider boundary, and preserves a smooth transition into the supervised repo write."
        : input.scenario === "fallback_path"
          ? "The proposal sharpens fallback copy, keeps the repo action supervised, and makes the skipped or degraded path explicit without breaking the flow."
          : "The proposal focuses on legible blocked-state language so the product shows restraint and guidance instead of a dead end.",
      "The change stays incremental and product-minded: tighten layout, strengthen microcopy, and keep the secure backend execution boundary unchanged.",
    ].join("\n\n");
    const patchFiles = [
      buildCreateFilePatch(
        "docs/devpilot/secure-action-review-note.md",
        buildReviewNoteContent({
          repo,
          branch: input.branch,
          scenario: input.scenario,
          summary: proposalSummary,
        }),
        "Create a deterministic review note so the secure repo handoff always has a clean, inspectable patch payload during the demo.",
      ),
      buildCreateFilePatch(
        "docs/devpilot/verification-checklist.md",
        buildVerificationChecklistContent(input.scenario),
        "Attach a concise verification checklist so judges can see the expected post-approval follow-up inside the same repo handoff story.",
      ),
    ];

    return {
      scenario: input.scenario,
      repo,
      repoName,
      branch: input.branch,
      defaultBranch,
      gitlabProjectId,
      gitlabProjectWebUrl: input.project?.webUrl,
      taskTitle,
      taskPrompt,
      sourceLabel: `Hackathon ${input.scenario.replace(/_/g, " ")} showcase`,
      issue: {
        title: issueTitle,
        summary: issueSummary,
        category: "ui",
        severity: input.scenario === "blocked_provider" ? "medium" : "high",
        confidence: 0.93,
        score: input.scenario === "golden_path" ? 94 : 88,
        easeOfFix: 0.71,
        impactBreadth: 0.78,
        relatedFiles: [
          "src/components/dashboard/SecureActionTaskCard.tsx",
          "src/components/settings/SecureDelegationSettingsPanel.tsx",
          "src/components/dashboard/SecureDelegationOverview.tsx",
        ],
        evidence: [
          "Approval and provider badges feel crowded when the workspace narrows.",
          "Judges need the trust boundary to read instantly without opening Settings.",
          "The secure story is strongest when the approval checkpoint remains the visual anchor.",
        ],
        suggestedPrompt: taskPrompt,
        dedupeKey: `hackathon-demo::${slugify(repo)}::${slugify(input.scenario)}::secure-approval-layout`,
      },
      candidateFiles: [
        "src/components/dashboard/SecureActionTaskCard.tsx",
        "src/components/settings/SecureDelegationSettingsPanel.tsx",
        "src/components/dashboard/SecureDelegationOverview.tsx",
      ],
      componentHints: [
        "hackathon_demo_showcase",
        "secure_action_demo",
        `scenario_${input.scenario}`,
      ],
      proposal: {
        title: issueTitle,
        summary: proposalSummary,
        explanation: proposalExplanation,
        recommendedStrategy:
          "Keep the secure approval card compact, preserve the current premium look, and make the repo provider, approval reason, and next secure action readable at a glance.",
        confidence: 0.94,
        suspectedFiles: [
          "src/components/dashboard/SecureActionTaskCard.tsx",
          "src/components/settings/SecureDelegationSettingsPanel.tsx",
          "src/components/dashboard/SecureDelegationOverview.tsx",
        ],
      },
      patchFiles,
      verificationPlan: {
        expectedOutcome:
          input.scenario === "golden_path"
            ? "Approval-required repo actions remain readable and clearly supervised across dashboard and task workspace widths."
            : input.scenario === "fallback_path"
              ? "Fallback and skipped-notification states stay clear without weakening the secure action story."
              : "Blocked delegated actions explain what happened, why they stopped, and what would unblock them.",
        checks: [
          "Confirm the secure handoff card keeps the action title, provider, and risk cue readable at a glance.",
          "Confirm approval messaging clearly states what will happen after approval.",
          "Confirm blocked or fallback messaging explains the trust boundary without sounding alarmist.",
        ],
      },
      artifacts: {
        screenshot: buildScreenshotDataUri({
          title: "Secure Handoff Review Surface",
          subtitle:
            input.scenario === "golden_path"
              ? "Approval boundary ready for repo write"
              : input.scenario === "fallback_path"
                ? "Fallback-secure repo handoff"
                : "Blocked provider boundary",
          chips:
            input.scenario === "golden_path"
              ? ["GitLab connected", "Slack connected", "Approval required", "Step-up ready"]
              : input.scenario === "fallback_path"
                ? ["GitLab fallback", "Slack optional", "Approval required", "Fallback visible"]
                : ["Provider missing", "Approval required", "Safe block", "No silent writes"],
        }),
        terminal: [
          "UI inspection summary",
          "- Approval metadata wraps too aggressively at narrower widths.",
          "- Provider and risk cues need a clearer reading order.",
          "- Secure backend boundary messaging should stay visible without extra clicks.",
          "",
          "Recommendation",
          "- Keep approval, provider, and outcome cues in a stable scan line.",
          "- Preserve the product look; do not turn the task workspace into a security console.",
        ].join("\n"),
        visionAnalysis: JSON.stringify(
          {
            summary: issueSummary,
            explanation:
              "The secure handoff surface already has the right building blocks, but the highest-value demo improvement is to keep approval context, provider boundary, and next action readable in one glance.",
          },
          null,
          2,
        ),
      },
      run: {
        currentStep:
          input.scenario === "golden_path"
            ? "Review-ready patch prepared. Secure repo handoff is ready."
            : input.scenario === "fallback_path"
              ? "Review-ready fallback scenario prepared. Supervised action is ready."
              : "Blocked-provider showcase prepared. Safe approval boundary is ready.",
        progress: input.scenario === "golden_path" ? 58 : 54,
        totalSteps: 9,
        completedSteps: 5,
        phase: "code_fix",
      },
      initialMessages: buildInitialMessages({
        scenario: input.scenario,
        repo,
        issueSummary,
        targetAppBaseUrl: input.targetAppBaseUrl,
      }),
    };
  },
};

function buildInitialMessages(args: {
  scenario: DemoScenarioKind;
  repo: string;
  issueSummary: string;
  targetAppBaseUrl: string;
}): Array<Omit<AgentMessage, "id" | "taskId" | "timestamp">> {
  return [
    {
      sender: "system",
      kind: "info",
      content: `Showcase task prepared for ${args.repo}. DevPilot already completed inspection and patch planning so the demo can focus on secure approval and delegated execution.`,
    },
    {
      sender: "devpilot",
      kind: "info",
      content: args.issueSummary,
    },
    {
      sender: "code_agent",
      kind: "info",
      content:
        args.scenario === "golden_path"
          ? "Prepared a compact review package for the secure handoff flow. The next step is a supervised repo write that will pause for approval."
          : args.scenario === "fallback_path"
            ? "Prepared a fallback-secure review package. The demo will keep the approval boundary visible even if one provider path is degraded."
            : "Prepared a blocked-action showcase. The product will request approval, evaluate the boundary, and stop safely when provider access is missing.",
      meta: {
        heading: "Patch Preparation",
        activities: [
          {
            type: "analyzed",
            file: "src/components/dashboard/SecureActionTaskCard.tsx",
            detail: "approval and risk scan line",
          },
          {
            type: "analyzed",
            file: "src/components/settings/SecureDelegationSettingsPanel.tsx",
            detail: "integration and permission cues",
          },
          {
            type: "created",
            file: "docs/devpilot/secure-action-review-note.md",
          },
        ],
      },
    },
    {
      sender: "devpilot",
      kind: "success",
      content:
        args.scenario === "golden_path"
          ? "Patch proposal is ready. Approval will be required before the repo write, and DevPilot will execute the provider action through secure delegated access."
          : args.scenario === "fallback_path"
            ? "Fallback-ready proposal is prepared. DevPilot can still demonstrate supervised delegated action behavior even if one live path is degraded."
            : "Blocked-path proposal is prepared. The demo will show a controlled stop with a clear reason and remediation hint.",
    },
    {
      sender: "system",
      kind: "thinking",
      content: `Target surface: ${args.targetAppBaseUrl}`,
    },
  ];
}

function buildReviewNoteContent(args: {
  repo: string;
  branch: string;
  scenario: DemoScenarioKind;
  summary: string;
}): string {
  return [
    "# DevPilot Secure Action Review Note",
    "",
    `Repository: ${args.repo}@${args.branch}`,
    `Scenario: ${args.scenario.replace(/_/g, " ")}`,
    "",
    "## Objective",
    args.summary,
    "",
    "## Why This Matters",
    "Judges should be able to understand the connected provider, approval boundary, and secure backend execution path in a single glance.",
  ].join("\n");
}

function buildVerificationChecklistContent(
  scenario: DemoScenarioKind,
): string {
  return [
    "# Verification Checklist",
    "",
    "- Confirm the secure approval card remains readable on desktop and tablet widths.",
    "- Confirm provider connection state is legible without opening deep settings.",
    "- Confirm the action outcome clearly says whether the action was allowed, blocked, or executed through fallback.",
    scenario === "golden_path"
      ? "- Confirm the verification follow-up reads: no regression detected."
      : "- Confirm the fallback or blocked outcome explains what happened and what would fix it.",
  ].join("\n");
}

function buildCreateFilePatch(
  filePath: string,
  content: string,
  explanation: string,
): {
  filePath: string;
  changeType: "create";
  patch: string;
  nextContent: string;
  explanation: string;
} {
  return {
    filePath,
    changeType: "create",
    patch: [
      `diff --git a/${filePath} b/${filePath}`,
      "new file mode 100644",
      "index 0000000..showcase",
      "--- /dev/null",
      `+++ b/${filePath}`,
      ...content.split("\n").map((line) => `+${line}`),
    ].join("\n"),
    nextContent: content,
    explanation,
  };
}

function buildScreenshotDataUri(args: {
  title: string;
  subtitle: string;
  chips: string[];
}): string {
  const chipMarkup = args.chips
    .map(
      (chip, index) => `
      <g transform="translate(${48 + index * 150},120)">
        <rect width="132" height="28" rx="14" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.08)" />
        <text x="66" y="18" text-anchor="middle" font-size="11" fill="#d7dee9" font-family="Segoe UI, Arial">${escapeXml(chip)}</text>
      </g>`,
    )
    .join("");
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0b1320"/>
          <stop offset="100%" stop-color="#161616"/>
        </linearGradient>
      </defs>
      <rect width="1280" height="720" fill="url(#bg)"/>
      <rect x="34" y="36" width="1212" height="648" rx="28" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)"/>
      <text x="58" y="86" font-size="18" fill="#f8fafc" font-family="Segoe UI, Arial" font-weight="700">${escapeXml(args.title)}</text>
      <text x="58" y="112" font-size="13" fill="#94a3b8" font-family="Segoe UI, Arial">${escapeXml(args.subtitle)}</text>
      ${chipMarkup}
      <rect x="58" y="184" width="610" height="188" rx="22" fill="rgba(0,0,0,0.22)" stroke="rgba(255,255,255,0.06)"/>
      <rect x="702" y="184" width="520" height="188" rx="22" fill="rgba(0,0,0,0.22)" stroke="rgba(255,255,255,0.06)"/>
      <rect x="58" y="402" width="1164" height="242" rx="22" fill="rgba(0,0,0,0.22)" stroke="rgba(255,255,255,0.06)"/>
      <text x="84" y="224" font-size="12" fill="#f59e0b" font-family="Segoe UI, Arial" font-weight="700">APPROVAL REQUIRED</text>
      <text x="84" y="254" font-size="22" fill="#f8fafc" font-family="Segoe UI, Arial" font-weight="700">Open supervised repo change</text>
      <text x="84" y="286" font-size="14" fill="#cbd5e1" font-family="Segoe UI, Arial">Approval pauses the write before DevPilot acts on the user's behalf.</text>
      <text x="728" y="224" font-size="12" fill="#38bdf8" font-family="Segoe UI, Arial" font-weight="700">SECURE BOUNDARY</text>
      <text x="728" y="254" font-size="22" fill="#f8fafc" font-family="Segoe UI, Arial" font-weight="700">Backend execution only</text>
      <text x="728" y="286" font-size="14" fill="#cbd5e1" font-family="Segoe UI, Arial">Provider tokens stay behind the BFF and Auth0 secure runtime.</text>
      <text x="84" y="438" font-size="12" fill="#22c55e" font-family="Segoe UI, Arial" font-weight="700">EXPECTED NARRATIVE</text>
      <text x="84" y="470" font-size="18" fill="#f8fafc" font-family="Segoe UI, Arial" font-weight="700">Connect -> inspect -> propose -> approve -> execute -> notify -> verify</text>
    </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
