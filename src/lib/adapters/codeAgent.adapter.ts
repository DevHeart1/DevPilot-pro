import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import {
  GitLabRepositoryFile,
  NormalizedFixRecommendation,
  PatchFile,
  PatchProposal,
  AgentMessage,
} from "../../types";
import { config } from "../config/env";
import { createUnifiedDiff } from "../utils/diff";

interface FixRecommendationInput {
  taskId: string;
  taskTitle: string;
  taskPrompt?: string;
  visionAnalysisResult: {
    issueType?: string;
    suspectedComponent?: string;
    explanation?: string;
    recommendedFix?: string;
    evidence?: string[];
    suggestedTags?: string[];
  };
  repoTreePaths: string[];
  memoryContent?: string;
}

interface PatchGenerationInput {
  taskId: string;
  recommendation: NormalizedFixRecommendation;
  files: GitLabRepositoryFile[];
}

function getAiClient(): GoogleGenAI {
  if (!config.isGeminiConfigured) {
    throw new Error(
      "Gemini is not configured. Set VITE_LIVE_MODE=true and VITE_GEMINI_API_KEY.",
    );
  }

  return new GoogleGenAI({ apiKey: config.geminiApiKey });
}

function parseJson<T>(text: string): T {
  const jsonText = text.replace(/```json\n?|\n?```/g, "").trim();
  return JSON.parse(jsonText) as T;
}

export const codeAgentAdapter = {
  async generateFixRecommendation(
    input: FixRecommendationInput,
  ): Promise<NormalizedFixRecommendation> {
    const ai = getAiClient();
    const prompt = `
# Identity
You are DevPilot Code Strategist — a senior-level code-fix planning agent, security auditor, and compliance expert. Your purpose is to analyze a UI defect report and a repository structure, then produce a precise surgical plan identifying the exact files to patch, the fix strategy, and any security or compliance concerns.

## Core Capabilities
- **Root Cause Analysis**: Tracing visual/runtime symptoms back to specific source files using component structure and error evidence.
- **Surgical File Targeting**: Identifying the minimal set of files that must be modified — no more, no fewer.
- **Security Auditing**: Proactively scanning the context for OWASP Top 10 vulnerabilities (XSS, injection, CSRF, etc.).
- **Compliance Verification**: Checking for accessibility (WCAG), privacy (data exposure), and architecture standards violations.

---

# Inputs
- **Task Title**: ${input.taskTitle}
- **Task Prompt**: ${input.taskPrompt || "None"}
- **Issue Type**: ${input.visionAnalysisResult.issueType || "unknown"}
- **Suspected Component**: ${input.visionAnalysisResult.suspectedComponent || "unknown"}
- **Explanation**: ${input.visionAnalysisResult.explanation || "None"}
- **Recommended Fix**: ${input.visionAnalysisResult.recommendedFix || "None"}
- **Evidence**: ${(input.visionAnalysisResult.evidence || []).join("\\n") || "None"}
- **Historical Memory**: ${input.memoryContent || "None"}
- **Repository Tree**: ${input.repoTreePaths.join("\\n")}

---

# Robustness & Error Handling
- **Missing Evidence**: If no evidence is provided, infer from the issue type and suspected component. Set confidence below 0.5.
- **Unknown Issue Type**: If issueType is "unknown", perform broader analysis across likely file candidates. Be conservative with file targeting.
- **Empty Repo Tree**: If the repo tree is empty or too short, flag this and set confidence below 0.3.
- **No Security Issues Found**: Return an empty array for securityAuditFaults — do NOT fabricate vulnerabilities.
- **No Compliance Issues Found**: Return an empty array for complianceChecks — do NOT fabricate violations.

---

# Strict Ontology
- **issueType**: [layout_overflow, visual_regression, console_error, network_error, accessibility_violation, rendering_failure, state_mismatch, logic_error, unknown]
- **tags**: Use lowercase kebab-case (e.g., "css-fix", "state-management", "error-boundary")
- **confidence**: 0.0 - 1.0 (calibrated based on evidence quality and file match certainty)

---

# Output Schema (Strict JSON)
Respond with ONLY valid JSON. No markdown, no commentary.
{
  "issueType": "string (from ontology)",
  "suspectedComponent": "string (primary component or module name)",
  "suspectedFiles": ["string (exact file paths from the repo tree that need modification)"],
  "explanation": "string (detailed root cause analysis connecting symptoms to code)",
  "recommendedFix": "string (specific technical fix strategy, not generic advice)",
  "evidence": ["string (each entry is a specific observation supporting the diagnosis)"],
  "tags": ["string (kebab-case classification tags)"],
  "securityAuditFaults": ["string (specific security vulnerability descriptions, or empty array)"],
  "complianceChecks": ["string (specific compliance issue descriptions, or empty array)"],
  "confidence": "number (0.0 - 1.0)"
}
`.trim();

    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: [prompt],
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
        tools: [
          { urlContext: {} },
          { codeExecution: {} },
          { googleSearch: {} },
        ],
      },
    });

    if (!response.text) {
      throw new Error("Gemini returned an empty fix recommendation response.");
    }

    const parsed = parseJson<Omit<NormalizedFixRecommendation, "taskId" | "sourceArtifactIds" | "agentThought">>(
      response.text,
    );

    const thoughtPart = response.candidates?.[0]?.content?.parts?.find((p) => (p as any).thought);
    const agentThought = thoughtPart ? (thoughtPart as any).thought : undefined;

    return {
      taskId: input.taskId,
      issueType: parsed.issueType,
      suspectedComponent: parsed.suspectedComponent,
      suspectedFiles: parsed.suspectedFiles,
      explanation: parsed.explanation,
      recommendedFix: parsed.recommendedFix,
      evidence: parsed.evidence,
      tags: parsed.tags,
      securityAuditFaults: parsed.securityAuditFaults || [],
      complianceChecks: parsed.complianceChecks || [],
      agentThought,
      confidence: parsed.confidence,
      sourceArtifactIds: [],
    };
  },

  async proposePatch(
    input: PatchGenerationInput,
  ): Promise<{ proposal: PatchProposal; files: PatchFile[]; agentThought?: string }> {
    const ai = getAiClient();

    const prompt = `
# Identity
You are DevPilot Code Surgeon — a production-grade TypeScript/React code generation engine. Your purpose is to receive a fix plan and the repository source files, then produce surgically precise code modifications that resolve the identified issue across ALL targeted files.

## Core Capabilities
- **Multi-File Patching**: Generating coherent code changes across multiple files simultaneously while maintaining cross-file consistency.
- **Full-Content Generation**: Producing complete, valid file contents (not diffs or fragments) that can be directly committed.
- **Architectural Awareness**: Understanding React component hierarchies, import chains, and state flow to produce patches that don't break adjacent systems.
- **TypeScript Safety**: Generating type-safe code that respects existing type definitions, generics, and strictness settings.

---

# Inputs
- **Issue Type**: ${input.recommendation.issueType}
- **Suspected Component**: ${input.recommendation.suspectedComponent}
- **Explanation**: ${input.recommendation.explanation}
- **Recommended Fix**: ${input.recommendation.recommendedFix}
- **Suspected Files (${input.recommendation.suspectedFiles.length} total)**: ${input.recommendation.suspectedFiles.join(", ")}
- **Evidence**: ${input.recommendation.evidence.join("\\n") || "None"}
- **Repository Files**: The full content of each file is provided below.

${input.files
        .map(
          (file) => `FILE: ${file.filePath}\n${file.content}`,
        )
        .join("\n\n====\n\n")}

---

# Critical Rules
1. **ALL FILES REQUIRED**: You MUST produce fixes for ALL ${input.recommendation.suspectedFiles.length} suspected files. Every suspected file MUST appear in your "files" array.
2. **Complete Content**: The "nextContent" field must contain the ENTIRE file content after modification — not a diff, not a snippet.
3. **Preserve Structure**: Do not reorganize imports, reformat code, or make changes unrelated to the fix unless they are necessary for the fix to work.
4. **No Fabrication**: Do not invent APIs, components, or libraries that don't exist in the provided repository context.

---

# Robustness & Error Handling
- **Missing File Content**: If a suspected file's content is not provided, generate a reasonable fix based on the file path, issue context, and related files. Set confidence below 0.5.
- **Conflicting Evidence**: If evidence conflicts with the recommended fix, prioritize the evidence and explain the deviation in your summary.
- **Unable to Fix**: If you cannot produce a valid fix for a file, include it in the output with changeType "update" and the original content unchanged. Explain in the file's explanation field why no change was made.

---

# Output Schema (Strict JSON)
Respond with ONLY valid JSON. No markdown fences, no commentary.
{
  "title": "string (concise conventional-commit-style title, e.g., 'fix: resolve WebGL context errors with fallback')",
  "summary": "string (1-3 sentence human-readable summary of all changes made)",
  "recommendedStrategy": "string (technical strategy description)",
  "explanation": "string (detailed explanation of approach and trade-offs)",
  "confidence": "number (0.0 - 1.0)",
  "files": [
    {
      "filePath": "string (exact path from repository)",
      "changeType": "update | create | delete",
      "explanation": "string (per-file explanation of what changed and why)",
      "nextContent": "string (complete file content after modification)"
    }
  ]
}
`.trim();

    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: [prompt],
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
        tools: [
          { urlContext: {} },
          { codeExecution: {} },
          { googleSearch: {} },
        ],
      },
    });

    if (!response.text) {
      throw new Error("Gemini returned an empty patch proposal response.");
    }

    const parsed = parseJson<{
      title: string;
      summary: string;
      recommendedStrategy: string;
      explanation: string;
      confidence: number;
      files: Array<{
        filePath: string;
        changeType: "update" | "create" | "delete";
        explanation: string;
        nextContent: string;
      }>;
    }>(response.text);

    const proposalId = crypto.randomUUID();
    const files = parsed.files.map((file) => {
      const currentFile = input.files.find(
        (item) => item.filePath === file.filePath,
      );
      const currentContent = currentFile?.content || "";
      return {
        id: crypto.randomUUID(),
        proposalId,
        taskId: input.taskId,
        filePath: file.filePath,
        changeType: file.changeType,
        patch: createUnifiedDiff(file.filePath, currentContent, file.nextContent),
        currentContent,
        nextContent: file.nextContent,
        explanation: file.explanation,
        createdAt: Date.now(),
      } satisfies PatchFile;
    });

    const proposal: PatchProposal = {
      id: proposalId,
      taskId: input.taskId,
      source: "gemini_code_agent",
      status: "ready_for_review",
      title: parsed.title,
      summary: parsed.summary,
      suspectedFiles: input.recommendation.suspectedFiles,
      recommendedStrategy: parsed.recommendedStrategy,
      explanation: parsed.explanation,
      confidence: parsed.confidence,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const thoughtPart = response.candidates?.[0]?.content?.parts?.find((p) => (p as any).thought);
    const agentThought = thoughtPart ? (thoughtPart as any).thought : undefined;

    return { proposal, files, agentThought };
  },

  async handleFollowUp(input: {
    taskId: string;
    taskTitle: string;
    messages: AgentMessage[];
    currentProposal?: PatchProposal;
    currentFiles?: PatchFile[];
    repoFiles?: GitLabRepositoryFile[];
  }): Promise<{ reply: string; proposal?: PatchProposal; files?: PatchFile[] }> {
    const ai = getAiClient();

    const prompt = `
# Identity
You are DevPilot Dialogue Agent — a senior code-fix agent engaged in an iterative conversation with a human developer. Your purpose is to interpret follow-up instructions, adjust proposed patches based on feedback, and provide clear, technical responses that advance the task toward resolution.

## Core Capabilities
- **Feedback Interpretation**: Parsing developer intent from conversational messages, distinguishing between questions, refinements, and new feature requests.
- **Incremental Patching**: Updating an existing patch proposal based on new instructions without regenerating unchanged files.
- **Context Maintenance**: Tracking the full conversation history to maintain consistency and avoid contradictions.
- **Clear Communication**: Producing concise, technically precise replies that acknowledge feedback and explain the updated approach.

---

# Inputs
- **Task Title**: ${input.taskTitle}
- **Conversation History**:
${input.messages
        .map((m) => `[${new Date(m.timestamp).toISOString()}] ${m.sender}: ${m.content}`)
        .join("\n")}
- **Current Patch Proposal**: ${input.currentProposal
        ? `Summary: ${input.currentProposal.summary}\nExplanation: ${input.currentProposal.explanation}`
        : "None"}
- **Repository Files (context)**:
${input.repoFiles
        ?.map((file) => `FILE: ${file.filePath}\n${file.content}`)
        .join("\n\n====\n\n") || "None"}

---

# Robustness & Error Handling
- **Ambiguous Feedback**: If the developer's instruction is unclear, ask a clarifying question in the reply and set hasCodeChanges to false.
- **No Code Changes Needed**: If the message is purely a question or acknowledgment, provide a helpful reply and leave the files array empty.
- **Conflicting Instructions**: If new feedback contradicts prior instructions, follow the latest instruction and note the change in the reply.
- **Missing Context**: If referenced files are not provided, explain the limitation in the reply and work with what is available.

---

# Decision Rules
- Set **hasCodeChanges = true** ONLY if the feedback explicitly or implicitly requires code modifications.
- Set **hasCodeChanges = false** for questions, clarifications, or acknowledgments.
- When hasCodeChanges is true, ALL required fields (title, summary, recommendedStrategy, explanation, files) MUST be populated.
- When hasCodeChanges is false, only "reply" is required; all other fields may be omitted or empty.

---

# Output Schema (Strict JSON)
Respond with ONLY valid JSON. No markdown, no commentary.
{
  "reply": "string (conversational response to the developer, acknowledging feedback and explaining approach)",
  "hasCodeChanges": "boolean (true if code modifications are needed)",
  "title": "string (conventional-commit title, required if hasCodeChanges=true)",
  "summary": "string (change summary, required if hasCodeChanges=true)",
  "recommendedStrategy": "string (fix strategy, required if hasCodeChanges=true)",
  "explanation": "string (detailed explanation, required if hasCodeChanges=true)",
  "files": [
    {
      "filePath": "string (exact path from repository)",
      "changeType": "update | create | delete",
      "explanation": "string (per-file explanation of what changed and why)",
      "nextContent": "string (complete file content after modification)"
    }
  ]
}
`.trim();

    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: [prompt],
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
        tools: [
          { urlContext: {} },
          { codeExecution: {} },
          { googleSearch: {} },
        ],
      },
    });

    if (!response.text) {
      throw new Error("Gemini returned an empty conversational response.");
    }

    const parsed = parseJson<{
      reply: string;
      hasCodeChanges: boolean;
      title?: string;
      summary?: string;
      recommendedStrategy?: string;
      explanation?: string;
      files?: Array<{
        filePath: string;
        changeType: "update" | "create" | "delete";
        explanation: string;
        nextContent: string;
      }>;
    }>(response.text);

    let newProposal: PatchProposal | undefined;
    let newFiles: PatchFile[] | undefined;

    if (parsed.hasCodeChanges && parsed.files && parsed.files.length > 0) {
      const proposalId = crypto.randomUUID();
      newFiles = parsed.files.map((file) => {
        const repoFile = input.repoFiles?.find((f) => f.filePath === file.filePath);
        const currentContent = repoFile?.content || "";
        return {
          id: crypto.randomUUID(),
          proposalId,
          taskId: input.taskId,
          filePath: file.filePath,
          changeType: file.changeType,
          patch: createUnifiedDiff(file.filePath, currentContent, file.nextContent),
          currentContent,
          nextContent: file.nextContent,
          explanation: file.explanation,
          createdAt: Date.now(),
        } satisfies PatchFile;
      });

      newProposal = {
        id: proposalId,
        taskId: input.taskId,
        source: "gemini_code_agent",
        status: "ready_for_review",
        title: parsed.title || "Refined Patch Proposal",
        summary: parsed.summary || "",
        suspectedFiles: newFiles.map((f) => f.filePath),
        recommendedStrategy: parsed.recommendedStrategy || "",
        explanation: parsed.explanation || "",
        confidence: 0.9,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    }

    return { reply: parsed.reply, proposal: newProposal, files: newFiles };
  },
};
