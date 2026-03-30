import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { config } from "../config/env";

export interface VisionAnalysisResult {
  summary: string;
  issueType:
  | "layout_overflow"
  | "visual_regression"
  | "console_error"
  | "network_error"
  | "unknown";
  severity: "low" | "medium" | "high";
  suspectedComponent: string;
  explanation: string;
  recommendedFix: string;
  confidence: number;
  evidence: string[];
  suggestedTags: string[];
}

export interface VerificationAnalysisResult {
  issueResolved: boolean;
  regressionDetected: boolean;
  summary: string;
  explanation: string;
  confidence: number;
}

export interface VerificationAnalysisInput {
  taskTitle: string;
  originalIssueSummary: string;
  expectedOutcome: string;
  beforeScreenshotBase64?: string;
  afterScreenshotBase64?: string;
  beforeConsoleLogs?: string[];
  afterConsoleLogs?: string[];
}

export interface VisionAnalysisInput {
  taskTitle: string;
  targetUrl: string;
  viewportWidth: number;
  viewportHeight: number;
  screenshotBase64?: string;
  consoleErrors?: string[];
  priorMemoryHints?: string;
  repoFiles?: Array<{ filePath: string; content: string }>;
}


function getAiClient(): GoogleGenAI {
  if (!config.isGeminiConfigured) {
    throw new Error(
      "Gemini is not configured. Set VITE_LIVE_MODE=true and VITE_GEMINI_API_KEY.",
    );
  }

  return new GoogleGenAI({ apiKey: config.geminiApiKey });
}

function parseJsonResponse<T>(text: string): T {
  const jsonText = text.replace(/```json\n?|\n?```/g, "").trim();
  return JSON.parse(jsonText) as T;
}

function imagePart(dataUri?: string) {
  if (!dataUri) {
    return null;
  }

  return {
    inlineData: {
      data: dataUri.replace(/^data:image\/\w+;base64,/, ""),
      mimeType: "image/png",
    },
  };
}

export const visionAnalysisAdapter = {
  async compareBeforeAfter(
    input: VerificationAnalysisInput,
  ): Promise<VerificationAnalysisResult> {
    const ai = getAiClient();

    const prompt = `
# Identity
You are DevPilot Verification Agent — a production-grade visual regression and state-comparison engine. Your purpose is to compare before/after application states and produce a definitive resolution verdict with structured evidence.

## Core Capabilities
- **Before/After Diffing**: Comparing two visual snapshots to detect whether the original defect was resolved, persists, or regressed.
- **Console Correlation**: Cross-referencing before/after console output to detect new runtime errors introduced by a fix.
- **Regression Detection**: Proactively identifying new issues introduced by the applied patch that were not present before.
- **Confidence Calibration**: Adjusting confidence based on evidence quality (e.g., screenshots vs. logs-only).

---

# Inputs
- **Task Title**: ${input.taskTitle}
- **Original Issue Summary**: ${input.originalIssueSummary}
- **Expected Outcome**: ${input.expectedOutcome}
- **Before Console Logs**: ${input.beforeConsoleLogs?.join("\\n") || "None"}
- **After Console Logs**: ${input.afterConsoleLogs?.join("\\n") || "None"}
- **Visual Context**: Before and after screenshots are attached (if available). Compare them pixel-by-pixel for visual changes.

---

# Robustness & Error Handling
- **Missing Before Screenshot**: If no before screenshot is available, rely on the original issue summary and console logs. Lower confidence to below 0.6.
- **Missing After Screenshot**: If no after screenshot is available, rely on console log changes only. This severely limits visual verification — set confidence below 0.4.
- **Identical Screenshots**: If before and after are visually identical, check console logs for changes. If both are unchanged, the fix likely did not apply — set issueResolved to false.
- **New Console Errors**: If new errors appear in the after logs that were not present before, set regressionDetected to true regardless of visual resolution.

---

# Strict Ontology
- **issueResolved**: true | false (binary determination)
- **regressionDetected**: true | false (did the fix introduce new problems?)
- **confidence**: 0.0 - 1.0 (calibrate based on evidence quality)

---

# Output Schema (Strict JSON)
Respond with ONLY valid JSON. No markdown, no commentary.
{
  "issueResolved": "boolean (true if the original defect is no longer present)",
  "regressionDetected": "boolean (true if new defects were introduced by the fix)",
  "summary": "string (1-2 sentence human-readable verdict)",
  "explanation": "string (detailed technical comparison of before vs. after states, referencing specific visual changes and console log diffs)",
  "confidence": "number (0.0 - 1.0, calibrated to evidence quality)"
}
`.trim();

    const contents = [prompt];
    const beforeImage = imagePart(input.beforeScreenshotBase64);
    const afterImage = imagePart(input.afterScreenshotBase64);
    if (beforeImage) {
      contents.push(beforeImage as never);
    }
    if (afterImage) {
      contents.push(afterImage as never);
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents,
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
      throw new Error("Gemini returned an empty verification response.");
    }

    return parseJsonResponse<VerificationAnalysisResult>(response.text);
  },

  async analyzeUi(input: VisionAnalysisInput): Promise<VisionAnalysisResult> {
    const ai = getAiClient();

    const prompt = `
# Role
You are the **Senior UI Intelligence Engine** for DevPilot. Your mission is to perform a high-fidelity audit of the provided user interface by correlating visual pixels with the underlying source code.

# Context
- **Task**: ${input.taskTitle}
- **Target URL**: ${input.targetUrl}
- **Viewport**: ${input.viewportWidth}x${input.viewportHeight}
- **Technical State**: ${input.consoleErrors?.length || 0 > 0 ? `Detected ${input.consoleErrors?.length} console errors.` : "No console errors detected."}

# Source Code Mapping
I have attached the content of ${input.repoFiles?.length || 0} critical components and style files from the repository. 
Use these files to:
1. **Identify the exact line number** and property causing a visual defect.
2. **Determine if a component is reusable** or contains hardcoded values that should be tokenized.
3. **Verify design system compliance** against the provided project structure.

# Inspection Protocol
1. **Visual Fidelity Analysis**: compare current render against modern web standards (alignment, spacing, typography, contrast).
2. **Pixel-to-Code Correlation**: for every visual issue found, find the corresponding JSX/TSX/CSS file and suggest the specific change.
3. **Regression Detection**: look for broken layouts, overlapping elements, or missing assets (svg/images).

# Strict Ontology
You MUST use only these values for type-safe downstream processing:
- **issueType**: [layout_overflow, visual_regression, console_error, network_error, accessibility_violation, rendering_failure, state_mismatch, unknown]
- **severity**: [critical, high, medium, low, informational]
- **suggestedTags**: Use lowercase kebab-case (e.g., "css-overflow", "js-runtime-error", "hydration-mismatch")

# Output Schema (Strict JSON)
Respond with ONLY valid JSON matching this structure. No markdown, no commentary.
{
  "summary": "string (1-2 sentence human-readable summary of the detected issue)",
  "issueType": "string (from ontology)",
  "severity": "string (from ontology)",
  "suspectedComponent": "string (best-guess component or file name, e.g., 'HeroSection', 'Navbar')",
  "explanation": "string (detailed technical explanation of root cause, referencing visual and console evidence)",
  "recommendedFix": "string (specific technical recommendation, not generic advice)",
  "confidence": "number (0.0 - 1.0)",
  "evidence": ["string (each entry is a distinct piece of evidence: a console error, a visual observation, a DOM anomaly)"],
  "suggestedTags": ["string (kebab-case classification tags for categorization)"]
}

# Attached Source Files
${(input.repoFiles || []).map(f => `--- FILE: ${f.filePath} ---\n${f.content.slice(0, 5000)}`).join('\n\n')}

ACT AS A SENIOR PRODUCT ENGINEER. BE PRECISE. BE CRITICAL.
`.trim();

    const contents = [prompt];
    const screenshotPart = imagePart(input.screenshotBase64);

    if (screenshotPart) {
      contents.push(screenshotPart as never);
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents,
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
      throw new Error("Gemini returned an empty UI analysis response.");
    }

    return parseJsonResponse<VisionAnalysisResult>(response.text);
  },
};
