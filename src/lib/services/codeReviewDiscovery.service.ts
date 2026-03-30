import {
  CodeReviewIssue,
  CodeReviewIssueCategory,
  CodeReviewIssueSeverity,
  CodeReviewIssueSource,
  GitLabRepositoryFile,
  GitLabRepositoryTreeEntry,
  RepoDiscoveryMemory,
} from "../../types";

const DISCOVERY_SOURCE: CodeReviewIssueSource = "background_discovery";
const DISCOVERY_FILE_PATTERN = /\.(tsx?|jsx?|mjs|cjs|css|scss|json)$/i;
const SOURCE_FILE_PATTERN = /\.(tsx?|jsx?)$/i;
const SCRIPT_FILE_PATTERN = /\.(tsx?|jsx?|mjs|cjs)$/i;
const STYLE_FILE_PATTERN = /\.(css|scss)$/i;
const TEST_FILE_PATTERN = /(^|\/)(__tests__|__mocks__)\/|(\.|-)(test|spec)\.(tsx?|jsx?)$/i;
const GENERATED_PATH_PATTERN = /(node_modules|dist|build|coverage|storybook-static|\.next|vendor)\//i;
const UI_RISK_PATTERN =
  /(w-screen|min-w-\[[0-9]{3,}px\]|overflow-x-hidden|100vw|position:\s*fixed|fixed\b|left-\[[0-9]{3,}px\]|\bh-screen\b)/i;
const SECRET_PATTERN =
  /(api[_-]?key|client[_-]?secret|access[_-]?token|private[_-]?key|bearer\s+[A-Za-z0-9._-]{12,}|sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{12,}|AIza[0-9A-Za-z\-_]{20,})/i;

type DiscoveredIssueDraft = Omit<
  CodeReviewIssue,
  | "id"
  | "repo"
  | "repoName"
  | "branch"
  | "defaultBranch"
  | "gitlabProjectId"
  | "gitlabProjectWebUrl"
  | "status"
  | "linkedTaskId"
  | "occurrenceCount"
  | "lastSeenAt"
  | "createdAt"
  | "updatedAt"
>;

export interface BackgroundDiscoveryInput {
  repo: string;
  repoName?: string;
  branch: string;
  triggerTaskId?: string;
  treeEntries: GitLabRepositoryTreeEntry[];
  fileContents: GitLabRepositoryFile[];
  memory: RepoDiscoveryMemory;
  source?: CodeReviewIssueSource;
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function roundConfidence(value: number): number {
  return Math.round(clamp(value) * 100) / 100;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function countMatches(content: string, pattern: RegExp): number {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const globalPattern = new RegExp(pattern.source, flags);
  return content.match(globalPattern)?.length || 0;
}

function fileLineCount(content: string): number {
  return content.split(/\r?\n/).length;
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function toCategoryLabel(category: CodeReviewIssueCategory): string {
  switch (category) {
    case "ui":
      return "UI / UX";
    case "security":
      return "Security";
    case "performance":
      return "Performance";
    case "code_health":
      return "Code Health";
    case "testing":
      return "Testing";
    case "cleanup":
      return "Cleanup";
  }
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function buildDedupeKey(
  repo: string,
  branch: string,
  category: CodeReviewIssueCategory,
  title: string,
  relatedFiles: string[],
): string {
  return [
    slugify(repo),
    slugify(branch),
    category,
    slugify(title),
    relatedFiles.slice().sort().map(slugify).join("--"),
  ].join("::");
}

function reviewPackKey(
  repo: string,
  branch: string,
  category: CodeReviewIssueCategory,
): string {
  return `${slugify(repo)}::${slugify(branch)}::${category}`;
}

function scoreIssue(
  severity: CodeReviewIssueSeverity,
  confidence: number,
  impactBreadth: number,
  easeOfFix: number,
  recurrenceBoost = 0,
): number {
  const severityScore =
    severity === "high" ? 0.9 : severity === "medium" ? 0.7 : 0.45;
  const normalizedConfidence = clamp(confidence);
  const normalizedImpact = clamp(impactBreadth);
  const normalizedEase = clamp(easeOfFix);

  return Math.round(
    Math.min(
      100,
      severityScore * 45 +
        normalizedConfidence * 25 +
        normalizedImpact * 20 +
        normalizedEase * 10 +
        recurrenceBoost,
    ),
  );
}

function recurrenceBoost(
  category: CodeReviewIssueCategory,
  relatedFiles: string[],
  memory: RepoDiscoveryMemory,
): number {
  const repeatedCategoryCount = memory.recurringCategories[category] || 0;
  const overlappingFiles = relatedFiles.filter((file) =>
    memory.recurringFiles.includes(file),
  ).length;

  return Math.min(12, repeatedCategoryCount * 2 + overlappingFiles * 1.5);
}

function preferredPrompt(
  repo: string,
  branch: string,
  title: string,
  category: CodeReviewIssueCategory,
  relatedFiles: string[],
): string {
  const fileHint = relatedFiles.length
    ? `Focus on ${relatedFiles.slice(0, 3).join(", ")}.`
    : "";

  switch (category) {
    case "ui":
      return `Audit ${title.toLowerCase()} in ${repo}@${branch}. Investigate the related UI surfaces, confirm the layout or responsiveness risk, and propose a safe patch. ${fileHint}`.trim();
    case "security":
      return `Review ${title.toLowerCase()} in ${repo}@${branch}. Trace the client-facing data flow, remove unsafe exposure patterns, and propose a secure patch with minimal surface-area changes. ${fileHint}`.trim();
    case "performance":
      return `Inspect ${title.toLowerCase()} in ${repo}@${branch}. Identify the highest-leverage performance bottleneck, validate the impact area, and propose a safe optimization patch. ${fileHint}`.trim();
    case "testing":
      return `Inspect testing coverage gaps in ${repo}@${branch}. Focus on the risky flows highlighted by this review issue and propose concrete coverage improvements or test scaffolding. ${fileHint}`.trim();
    case "cleanup":
      return `Review ${title.toLowerCase()} in ${repo}@${branch}. Clean up the noisy or stale implementation patterns, keep behavior stable, and propose a low-risk patch. ${fileHint}`.trim();
    case "code_health":
      return `Audit ${title.toLowerCase()} in ${repo}@${branch}. Break down the maintainability risk, identify the safest refactor path, and propose a contained patch plan. ${fileHint}`.trim();
  }
}

function chooseSeverity(value: number): CodeReviewIssueSeverity {
  if (value >= 0.8) {
    return "high";
  }

  if (value >= 0.58) {
    return "medium";
  }

  return "low";
}

function issueDraft(
  input: BackgroundDiscoveryInput,
  category: CodeReviewIssueCategory,
  title: string,
  summary: string,
  relatedFiles: string[],
  evidence: string[],
  confidence: number,
  impactBreadth: number,
  easeOfFix: number,
  severityOverride?: CodeReviewIssueSeverity,
): DiscoveredIssueDraft {
  const boostedConfidence = roundConfidence(
    confidence +
      Math.min(0.12, recurrenceBoost(category, relatedFiles, input.memory) / 100),
  );
  const severity = severityOverride || chooseSeverity(boostedConfidence);
  const score = scoreIssue(
    severity,
    boostedConfidence,
    impactBreadth,
    easeOfFix,
    recurrenceBoost(category, relatedFiles, input.memory),
  );

  return {
    title,
    summary,
    category,
    severity,
    confidence: boostedConfidence,
    score,
    easeOfFix: clamp(easeOfFix),
    impactBreadth: clamp(impactBreadth),
    source: input.source || DISCOVERY_SOURCE,
    relatedFiles: unique(relatedFiles).slice(0, 5),
    evidence: unique(evidence).slice(0, 6),
    suggestedPrompt: preferredPrompt(
      input.repo,
      input.branch,
      title,
      category,
      relatedFiles,
    ),
    dedupeKey: buildDedupeKey(
      input.repo,
      input.branch,
      category,
      title,
      relatedFiles,
    ),
    reviewPackKey: reviewPackKey(input.repo, input.branch, category),
    triggerTaskId: input.triggerTaskId,
  };
}

function sourcePaths(treeEntries: GitLabRepositoryTreeEntry[]): string[] {
  return treeEntries
    .filter((entry) => entry.type === "blob")
    .map((entry) => entry.path)
    .filter(
      (path) => DISCOVERY_FILE_PATTERN.test(path) && !GENERATED_PATH_PATTERN.test(path),
    );
}

function pathPriority(path: string): number {
  const lower = path.toLowerCase();
  let score = 0;

  if (lower === "package.json") score += 140;
  if (/vite\.config|next\.config|tailwind\.config|tsconfig/.test(lower)) score += 120;
  if (/src\/main|src\/app|app\/layout|app\/page|pages\/|routes\//.test(lower)) score += 100;
  if (/(auth|session|login|signup|token|api|client|service|fetch|request)/.test(lower)) score += 95;
  if (/(component|layout|modal|dialog|overlay|hero|dashboard|nav|header|footer)/.test(lower)) score += 85;
  if (TEST_FILE_PATTERN.test(lower)) score += 70;
  if (STYLE_FILE_PATTERN.test(lower)) score += 50;
  if (SOURCE_FILE_PATTERN.test(lower)) score += 35;

  return score;
}

export const codeReviewDiscoveryService = {
  selectFilePathsForDiscovery(
    treeEntries: GitLabRepositoryTreeEntry[],
    maxFiles = 18,
  ): string[] {
    return sourcePaths(treeEntries)
      .sort((left, right) => {
        const scoreDelta = pathPriority(right) - pathPriority(left);
        if (scoreDelta !== 0) {
          return scoreDelta;
        }

        return left.length - right.length;
      })
      .slice(0, maxFiles);
  },

  discoverIssues(input: BackgroundDiscoveryInput): DiscoveredIssueDraft[] {
    const issues: DiscoveredIssueDraft[] = [];
    const paths = sourcePaths(input.treeEntries);
    const lowerCasePaths = paths.map((path) => path.toLowerCase());
    const fileMap = new Map(
      input.fileContents.map((file) => [file.filePath, file.content]),
    );
    const sampledEntries = input.fileContents.map((file) => ({
      path: file.filePath,
      content: file.content,
      lowerPath: file.filePath.toLowerCase(),
      lines: fileLineCount(file.content),
    }));

    const sourceFileCount = lowerCasePaths.filter((path) => SCRIPT_FILE_PATTERN.test(path)).length;
    const testFiles = lowerCasePaths.filter((path) => TEST_FILE_PATTERN.test(path));
    const routeFiles = lowerCasePaths.filter((path) => /(pages|routes|app)\//.test(path));
    const uiFiles = sampledEntries.filter(
      (entry) => SOURCE_FILE_PATTERN.test(entry.path) || STYLE_FILE_PATTERN.test(entry.path),
    );
    const hasReactSignals =
      lowerCasePaths.some((path) => path === "package.json") &&
      /react|vite|next/i.test(fileMap.get("package.json") || "");

    const securityHits = sampledEntries
      .filter(
        (entry) =>
          SCRIPT_FILE_PATTERN.test(entry.path) &&
          !/server|backend|scripts\//i.test(entry.lowerPath),
      )
      .flatMap((entry) => {
        const findings: string[] = [];
        if (/import\.meta\.env|process\.env\./i.test(entry.content)) {
          findings.push(`${entry.path} reads runtime secrets directly in client code.`);
        }
        if (/authorization\s*:|bearer\s+/i.test(entry.content)) {
          findings.push(`${entry.path} builds Authorization headers on the client.`);
        }
        if (/localStorage\.(getItem|setItem)\([^)]*token/i.test(entry.content)) {
          findings.push(`${entry.path} handles access tokens via localStorage.`);
        }
        if (SECRET_PATTERN.test(entry.content)) {
          findings.push(`${entry.path} appears to include a literal credential or token-shaped secret.`);
        }
        return findings;
      });

    if (securityHits.length > 0) {
      const relatedFiles = sampledEntries
        .filter((entry) => securityHits.some((hit) => hit.startsWith(entry.path)))
        .map((entry) => entry.path)
        .slice(0, 4);
      issues.push(
        issueDraft(
          input,
          "security",
          "Review client-side secret handling and API exposure",
          `Potential client-side secret or token handling patterns were detected in ${relatedFiles.join(", ")}.`,
          relatedFiles,
          securityHits.slice(0, 5),
          securityHits.some((hit) => /literal credential|Authorization/i.test(hit)) ? 0.86 : 0.72,
          0.78,
          0.56,
          securityHits.some((hit) => /literal credential/i.test(hit)) ? "high" : "medium",
        ),
      );
    }

    const authLikeFiles = lowerCasePaths.filter((path) =>
      /(auth|session|login|signup|api|client|request|fetch)/.test(path),
    );
    if (sourceFileCount >= 8 && testFiles.length <= Math.max(1, Math.floor(sourceFileCount * 0.03))) {
      const relatedFiles = unique(
        authLikeFiles.slice(0, 4).map((path) => paths.find((entry) => entry.toLowerCase() === path) || path),
      );
      issues.push(
        issueDraft(
          input,
          "testing",
          "Inspect testing gaps around critical user and API flows",
          testFiles.length === 0
            ? `No obvious test files were detected while ${sourceFileCount} source files are present.`
            : `Test coverage looks thin relative to ${sourceFileCount} source files and ${authLikeFiles.length} risky flow files.`,
          relatedFiles,
          [
            `Discovered ${sourceFileCount} source files but only ${testFiles.length} test file(s).`,
            authLikeFiles.length > 0
              ? `Critical flow signals detected in ${authLikeFiles.slice(0, 4).join(", ")}.`
              : "This repository exposes multiple app surfaces without strong test signals.",
          ],
          testFiles.length === 0 ? 0.77 : 0.68,
          authLikeFiles.length > 0 ? 0.72 : 0.56,
          0.63,
          authLikeFiles.length > 2 && testFiles.length === 0 ? "high" : "medium",
        ),
      );
    }

    const cleanupSignals = sampledEntries.flatMap((entry) => {
      const findings: string[] = [];
      const todoCount = countMatches(entry.content, /\b(TODO|FIXME|HACK|XXX)\b/gi);
      const consoleCount = countMatches(entry.content, /console\.(log|debug|warn)\(/g);
      const debuggerCount = countMatches(entry.content, /\bdebugger\b/g);

      if (todoCount > 0) {
        findings.push(`${entry.path} contains ${todoCount} TODO/FIXME marker(s).`);
      }
      if (consoleCount >= 2) {
        findings.push(`${entry.path} still includes ${consoleCount} console statements.`);
      }
      if (debuggerCount > 0) {
        findings.push(`${entry.path} contains ${debuggerCount} debugger statement(s).`);
      }

      return findings;
    });

    if (cleanupSignals.length > 0) {
      const relatedFiles = sampledEntries
        .filter((entry) => cleanupSignals.some((hit) => hit.startsWith(entry.path)))
        .map((entry) => entry.path)
        .slice(0, 4);
      issues.push(
        issueDraft(
          input,
          "cleanup",
          "Trim stale debugging hooks and cleanup markers",
          `The repository still shows debug or cleanup residue in ${relatedFiles.join(", ")}.`,
          relatedFiles,
          cleanupSignals.slice(0, 5),
          cleanupSignals.some((hit) => /debugger/i.test(hit)) ? 0.73 : 0.62,
          0.46,
          0.88,
          "low",
        ),
      );
    }

    const complexityCandidates = sampledEntries
      .map((entry) => {
        const stateHookCount = countMatches(entry.content, /use(State|Effect|Reducer|Memo|Callback)\(/g);
        const exportCount = countMatches(entry.content, /\bexport\b/g);
        return {
          path: entry.path,
          lines: entry.lines,
          stateHookCount,
          exportCount,
        };
      })
      .filter((entry) => entry.lines >= 260 || entry.stateHookCount >= 6)
      .sort((left, right) => right.lines - left.lines);

    if (complexityCandidates.length > 0) {
      const relatedFiles = complexityCandidates.slice(0, 4).map((entry) => entry.path);
      issues.push(
        issueDraft(
          input,
          "code_health",
          "Refactor oversized modules with rising maintenance risk",
          `${relatedFiles[0]} and related files look unusually large or state-heavy for a single module.`,
          relatedFiles,
          complexityCandidates.slice(0, 4).map(
            (entry) =>
              `${entry.path} spans ${entry.lines} lines with ${entry.stateHookCount} React hook calls and ${entry.exportCount} export markers.`,
          ),
          complexityCandidates[0].lines >= 420 ? 0.8 : 0.69,
          0.68,
          0.52,
          complexityCandidates[0].lines >= 520 ? "high" : "medium",
        ),
      );
    }

    const lazyLoadingSignals = sampledEntries.some((entry) =>
      /React\.lazy\(|lazy\(\s*\(\)\s*=>|import\(/.test(entry.content),
    );
    const heavyUiComponent = sampledEntries.find(
      (entry) =>
        SOURCE_FILE_PATTERN.test(entry.path) &&
        entry.lines >= 280 &&
        countMatches(entry.content, /use(State|Effect|DeferredValue|Transition)\(/g) >= 3,
    );
    if ((routeFiles.length >= 4 && !lazyLoadingSignals) || heavyUiComponent) {
      const relatedFiles = unique([
        ...(heavyUiComponent ? [heavyUiComponent.path] : []),
        ...paths
          .filter((path) => /(pages|routes|app|dashboard|home)/i.test(path))
          .slice(0, 3),
      ]);
      issues.push(
        issueDraft(
          input,
          "performance",
          "Investigate avoidable rendering and bundle pressure",
          heavyUiComponent
            ? `${heavyUiComponent.path} looks large and state-heavy, which may create render churn or bundle drag.`
            : `The app exposes ${routeFiles.length} route-level files without obvious lazy-loading signals in the sampled code.`,
          relatedFiles,
          [
            heavyUiComponent
              ? `${heavyUiComponent.path} spans ${heavyUiComponent.lines} lines with multiple render-related hooks.`
              : `Detected ${routeFiles.length} route-like files without matching lazy-loading signals.`,
            lazyLoadingSignals
              ? "Some lazy-loading exists, but one heavy surface still stands out."
              : "No clear route-splitting signal was found in the discovery sample.",
          ],
          heavyUiComponent ? 0.72 : 0.65,
          0.62,
          0.57,
          "medium",
        ),
      );
    }

    const uiRiskHits = uiFiles
      .filter((entry) => UI_RISK_PATTERN.test(entry.content))
      .map((entry) => {
        const responsiveSignals = countMatches(entry.content, /\bsm:|\bmd:|\blg:|\bxl:/g);
        return {
          path: entry.path,
          responsiveSignals,
          content: entry.content,
        };
      });

    if (hasReactSignals && uiRiskHits.length > 0) {
      const relatedFiles = uiRiskHits.slice(0, 4).map((entry) => entry.path);
      issues.push(
        issueDraft(
          input,
          "ui",
          "Audit layout overflow and responsive edge cases",
          `Potential layout or overflow risks were detected in ${relatedFiles.join(", ")}.`,
          relatedFiles,
          uiRiskHits.slice(0, 4).map((entry) => {
            const issueDetail = UI_RISK_PATTERN.exec(entry.content)?.[0] || "layout-risk pattern";
            return entry.responsiveSignals === 0
              ? `${entry.path} contains "${issueDetail}" without obvious responsive utility coverage.`
              : `${entry.path} contains "${issueDetail}", which is worth checking against smaller viewports.`;
          }),
          uiRiskHits.some((entry) => entry.responsiveSignals === 0) ? 0.69 : 0.61,
          0.58,
          0.66,
          "medium",
        ),
      );
    }

    return issues
      .sort((left, right) => right.score - left.score)
      .slice(0, 8);
  },
};
