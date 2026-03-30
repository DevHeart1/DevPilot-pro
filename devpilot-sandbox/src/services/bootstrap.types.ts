export type PackageManager = "npm" | "yarn" | "pnpm";
export type LockfileName = "pnpm-lock.yaml" | "package-lock.json" | "yarn.lock";
export type FrameworkType = "vite" | "nextjs" | "react-spa" | "node";
export type RuntimeType = "frontend" | "node";
export type VerificationStatus = "pass" | "warn" | "fail";

export interface VerificationCheck {
    name: string;
    status: VerificationStatus;
    detail: string;
}

export interface FrameworkInfo {
    framework: FrameworkType;
    runtime: RuntimeType;
    buildScriptName: string | null;
    devScriptName: string | null;
    previewScriptName: string | null;
    buildCommand: string | null;
    devCommand: string | null;
    previewCommand: string | null;
    requiredBinaries: string[];
    signals: string[];
}

export interface PackageManagerInfo {
    packageManager: PackageManager;
    detectedLockfile: LockfileName | null;
    lockfilePath: string | null;
    installRoot: string;
    warnings: string[];
}

export interface WorkspaceCandidate {
    absolutePath: string;
    relativePath: string;
    score: number;
    reasons: string[];
    framework: FrameworkType;
    packageManager: PackageManager;
    detectedLockfile: LockfileName | null;
}

export interface WorkspaceAnalysis {
    repoRoot: string;
    appRoot: string;
    installRoot: string;
    framework: FrameworkInfo;
    packageManager: PackageManager;
    detectedLockfile: LockfileName | null;
    detectedLockfilePath: string | null;
    candidateRootsConsidered: WorkspaceCandidate[];
    reasoning: string[];
    warnings: string[];
}

export interface CommandPlan {
    packageManager: PackageManager;
    detectedLockfile: LockfileName | null;
    installCommandUsed: string;
    buildCommandUsed: string | null;
    devCommandUsed: string | null;
    previewCommandUsed: string | null;
}

export interface ToolingPreparationResult {
    packageManager: PackageManager;
    packageManagerBinaryReady: boolean;
    installedWith: "preinstalled" | "corepack" | "npm-global" | "unavailable";
    verificationChecks: VerificationCheck[];
    warnings: string[];
}

export interface BootstrapMetadata {
    repoRoot: string;
    appRoot: string;
    installRoot: string;
    runtimeTargetUrl: string;
    framework: FrameworkType;
    packageManager: PackageManager;
    detectedLockfile: LockfileName | null;
    detectedLockfilePath: string | null;
    installCommandUsed: string;
    buildCommandUsed: string | null;
    devCommandUsed: string | null;
    previewCommandUsed: string | null;
    candidateRootsConsidered: WorkspaceCandidate[];
    reasoning: string[];
    verificationChecks: VerificationCheck[];
    warnings: string[];
    success: boolean;
}
