import path from "path";
import fs from "fs";
import {
    FrameworkInfo,
    FrameworkType,
    LockfileName,
    PackageManager,
    PackageManagerInfo,
    WorkspaceAnalysis,
    WorkspaceCandidate,
} from "./bootstrap.types";

interface PackageJsonContent {
    name?: string;
    private?: boolean;
    packageManager?: string;
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    workspaces?: unknown;
}

interface CandidateInspection {
    absolutePath: string;
    relativePath: string;
    score: number;
    reasons: string[];
    packageJson: PackageJsonContent;
    framework: FrameworkInfo;
    packageManagerInfo: PackageManagerInfo;
}

const MAX_SCAN_DEPTH = 5;
const EXCLUDED_DIRS = new Set([
    ".git",
    ".github",
    ".next",
    ".nuxt",
    ".turbo",
    ".vercel",
    "build",
    "coverage",
    "dist",
    "node_modules",
    "out",
    "tmp",
    "temp",
]);
const LOCKFILE_PRIORITY: Array<{ name: LockfileName; packageManager: PackageManager }> = [
    { name: "pnpm-lock.yaml", packageManager: "pnpm" },
    { name: "package-lock.json", packageManager: "npm" },
    { name: "yarn.lock", packageManager: "yarn" },
];
const PREFERRED_PATH_SCORES: Record<string, number> = {
    "": 18,
    "app": 40,
    "apps/app": 58,
    "apps/web": 60,
    "client": 50,
    "frontend": 52,
    "packages/app": 42,
    "packages/web": 42,
    "web": 48,
    "website": 46,
};
const VITE_CONFIG_FILES = [
    "vite.config.ts",
    "vite.config.js",
    "vite.config.mjs",
    "vite.config.cjs",
];
const NEXT_CONFIG_FILES = [
    "next.config.ts",
    "next.config.js",
    "next.config.mjs",
    "next.config.cjs",
];

export class WorkspaceService {
    private currentAnalysis: WorkspaceAnalysis | null = null;

    async setupWorkspace(repoPath: string): Promise<WorkspaceAnalysis> {
        const absoluteRepoPath = path.resolve(repoPath);
        console.log(`[WORKSPACE] Analyzing repository at: ${absoluteRepoPath}`);

        const candidates = this.findCandidateRoots(absoluteRepoPath);
        const sortedCandidates = [...candidates].sort((left, right) => {
            if (right.score !== left.score) {
                return right.score - left.score;
            }

            return left.relativePath.length - right.relativePath.length;
        });

        const selectedCandidate = sortedCandidates[0];
        let analysis: WorkspaceAnalysis;

        if (!selectedCandidate) {
            const packageManagerInfo = this.getPackageManagerInfo(absoluteRepoPath, absoluteRepoPath);
            const fallbackFramework = this.createGenericNodeFramework();
            const warnings = [
                "No package.json candidate was found during workspace scan. Falling back to the repository root.",
                ...packageManagerInfo.warnings,
            ];

            analysis = {
                repoRoot: absoluteRepoPath,
                appRoot: absoluteRepoPath,
                installRoot: packageManagerInfo.installRoot,
                framework: fallbackFramework,
                packageManager: packageManagerInfo.packageManager,
                detectedLockfile: packageManagerInfo.detectedLockfile,
                detectedLockfilePath: packageManagerInfo.lockfilePath,
                candidateRootsConsidered: [],
                reasoning: ["Fell back to repository root because no package.json candidates were found."],
                warnings,
            };
        } else {
            const reasoning = [
                `Selected ${selectedCandidate.relativePath || "/"} as the app root with score ${selectedCandidate.score}.`,
                ...selectedCandidate.reasons,
                `Framework signals: ${selectedCandidate.framework.signals.join("; ") || "generic Node defaults"}.`,
            ];

            if (selectedCandidate.packageManagerInfo.installRoot !== selectedCandidate.absolutePath) {
                reasoning.push(
                    `Using ${this.toRelativePath(absoluteRepoPath, selectedCandidate.packageManagerInfo.installRoot) || "/"} as the install root because the lockfile was found there.`,
                );
            }

            analysis = {
                repoRoot: absoluteRepoPath,
                appRoot: selectedCandidate.absolutePath,
                installRoot: selectedCandidate.packageManagerInfo.installRoot,
                framework: selectedCandidate.framework,
                packageManager: selectedCandidate.packageManagerInfo.packageManager,
                detectedLockfile: selectedCandidate.packageManagerInfo.detectedLockfile,
                detectedLockfilePath: selectedCandidate.packageManagerInfo.lockfilePath,
                candidateRootsConsidered: sortedCandidates.map((candidate) => this.toWorkspaceCandidate(candidate)),
                reasoning,
                warnings: [...selectedCandidate.packageManagerInfo.warnings],
            };
        }

        this.currentAnalysis = analysis;
        this.logWorkspaceAnalysis(analysis);

        return analysis;
    }

    getCurrentWorkspaceAnalysis(): WorkspaceAnalysis | null {
        return this.currentAnalysis;
    }

    getPackageManagerInfo(dir: string, repoRoot?: string): PackageManagerInfo {
        const resolvedDir = path.resolve(dir);
        const resolvedRepoRoot = repoRoot ? path.resolve(repoRoot) : resolvedDir;
        const warnings: string[] = [];

        let currentDir = resolvedDir;

        while (true) {
            for (const entry of LOCKFILE_PRIORITY) {
                const lockfilePath = path.join(currentDir, entry.name);
                if (fs.existsSync(lockfilePath)) {
                    return {
                        packageManager: entry.packageManager,
                        detectedLockfile: entry.name,
                        lockfilePath,
                        installRoot: currentDir,
                        warnings,
                    };
                }
            }

            if (currentDir === resolvedRepoRoot) {
                break;
            }

            const parentDir = path.dirname(currentDir);
            if (parentDir === currentDir || !this.isWithinRoot(parentDir, resolvedRepoRoot)) {
                break;
            }

            currentDir = parentDir;
        }

        const packageJsonSource = this.findNearestPackageJsonWithPackageManager(resolvedDir, resolvedRepoRoot);
        if (packageJsonSource) {
            warnings.push(
                `No lockfile was found. Falling back to packageManager=${packageJsonSource.packageManager} from ${this.toRelativePath(resolvedRepoRoot, packageJsonSource.dir) || "/"}.`,
            );

            return {
                packageManager: packageJsonSource.packageManager,
                detectedLockfile: null,
                lockfilePath: null,
                installRoot: packageJsonSource.dir,
                warnings,
            };
        }

        warnings.push("No lockfile was found. Falling back to npm in the detected app root.");
        return {
            packageManager: "npm",
            detectedLockfile: null,
            lockfilePath: null,
            installRoot: resolvedDir,
            warnings,
        };
    }

    getWorkspaceInfo() {
        if (!this.currentAnalysis) {
            return {
                repoPath: null,
                appPath: null,
                installRoot: null,
                packageJsonExists: false,
                packageManager: "npm" as PackageManager,
                lockfile: null as LockfileName | null,
                framework: "node" as FrameworkType,
            };
        }

        return {
            repoPath: this.currentAnalysis.repoRoot,
            appPath: this.currentAnalysis.appRoot,
            installRoot: this.currentAnalysis.installRoot,
            packageJsonExists: this.hasPackageJson(this.currentAnalysis.appRoot),
            packageManager: this.currentAnalysis.packageManager,
            lockfile: this.currentAnalysis.detectedLockfile,
            framework: this.currentAnalysis.framework.framework,
        };
    }

    private findCandidateRoots(repoRoot: string): CandidateInspection[] {
        const candidates: CandidateInspection[] = [];
        const queue: Array<{ dir: string; depth: number }> = [{ dir: repoRoot, depth: 0 }];
        const visited = new Set<string>();

        while (queue.length > 0) {
            const current = queue.shift();
            if (!current) {
                continue;
            }

            const resolvedDir = path.resolve(current.dir);
            if (visited.has(resolvedDir)) {
                continue;
            }

            visited.add(resolvedDir);

            const dirents = this.safeReadDir(resolvedDir);
            if (!dirents) {
                continue;
            }

            if (dirents.some((entry) => entry.isFile() && entry.name === "package.json")) {
                const candidate = this.inspectCandidate(repoRoot, resolvedDir);
                if (candidate) {
                    candidates.push(candidate);
                }
            }

            if (current.depth >= MAX_SCAN_DEPTH) {
                continue;
            }

            for (const entry of dirents) {
                if (!entry.isDirectory() || !this.shouldTraverseDirectory(entry.name)) {
                    continue;
                }

                queue.push({
                    dir: path.join(resolvedDir, entry.name),
                    depth: current.depth + 1,
                });
            }
        }

        return candidates;
    }

    private inspectCandidate(repoRoot: string, candidateDir: string): CandidateInspection | null {
        const packageJson = this.readPackageJson(candidateDir);
        if (!packageJson) {
            return null;
        }

        const framework = this.detectFramework(candidateDir, packageJson);
        const packageManagerInfo = this.getPackageManagerInfo(candidateDir, repoRoot);
        const relativePath = this.toRelativePath(repoRoot, candidateDir);
        const { score, reasons } = this.scoreCandidate(relativePath, candidateDir, packageJson, framework, packageManagerInfo);

        return {
            absolutePath: candidateDir,
            relativePath,
            score,
            reasons,
            packageJson,
            framework,
            packageManagerInfo,
        };
    }

    private detectFramework(dir: string, packageJson: PackageJsonContent): FrameworkInfo {
        const scripts = packageJson.scripts ?? {};
        const dependencies = this.collectDependencies(packageJson);
        const signals: string[] = [];
        const requiredBinaries = new Set<string>();

        const hasViteConfig = VITE_CONFIG_FILES.some((file) => fs.existsSync(path.join(dir, file)));
        const hasNextConfig = NEXT_CONFIG_FILES.some((file) => fs.existsSync(path.join(dir, file)));
        const hasSrcDir = fs.existsSync(path.join(dir, "src"));
        const hasAppDir = fs.existsSync(path.join(dir, "app"));
        const hasPagesDir = fs.existsSync(path.join(dir, "pages"));
        const hasPublicDir = fs.existsSync(path.join(dir, "public"));
        const hasReact = Boolean(dependencies.react || dependencies["react-dom"]);
        const hasNext = Boolean(dependencies.next) || hasNextConfig;
        const hasVite = Boolean(dependencies.vite) || hasViteConfig;
        const hasReactScripts = Boolean(dependencies["react-scripts"]);

        let framework: FrameworkType = "node";
        let buildCommand = scripts.build?.trim() ?? null;
        let devCommand = scripts.dev?.trim() ?? null;
        let previewCommand = scripts.preview?.trim() ?? scripts.start?.trim() ?? null;

        if (hasNext) {
            framework = "nextjs";
            signals.push(hasNextConfig ? "next.config.* present" : "next dependency present");
            buildCommand = buildCommand ?? "next build";
            devCommand = devCommand ?? "next dev -H 0.0.0.0 -p 3000";
            previewCommand = previewCommand ?? "next start -H 0.0.0.0 -p 3000";
            requiredBinaries.add("next");
        } else if (hasVite) {
            framework = "vite";
            signals.push(hasViteConfig ? "vite.config.* present" : "vite dependency present");
            buildCommand = buildCommand ?? "vite build";
            devCommand = devCommand ?? "vite --host 0.0.0.0 --port 3000";
            previewCommand = previewCommand ?? "vite preview --host 0.0.0.0 --port 3000";
            requiredBinaries.add("vite");
        } else if (hasReact || hasSrcDir || hasAppDir || hasPagesDir) {
            framework = "react-spa";
            if (hasReact) {
                signals.push("react dependency present");
            }
            if (hasSrcDir) {
                signals.push("src/ directory present");
            }
            if (hasAppDir) {
                signals.push("app/ directory present");
            }
            if (hasPagesDir) {
                signals.push("pages/ directory present");
            }

            if (hasReactScripts) {
                buildCommand = buildCommand ?? "react-scripts build";
                devCommand = devCommand ?? "react-scripts start";
                requiredBinaries.add("react-scripts");
            }
        } else {
            signals.push("defaulted to generic Node app");
        }

        if (scripts.build) {
            signals.push("build script present");
        }
        if (scripts.dev) {
            signals.push("dev script present");
        }
        if (scripts.preview) {
            signals.push("preview script present");
        }
        if (hasPublicDir) {
            signals.push("public/ directory present");
        }

        for (const binary of this.detectBinariesFromCommands([buildCommand, devCommand, previewCommand])) {
            requiredBinaries.add(binary);
        }

        return {
            framework,
            runtime: framework === "node" ? "node" : "frontend",
            buildScriptName: scripts.build ? "build" : null,
            devScriptName: scripts.dev ? "dev" : null,
            previewScriptName: scripts.preview ? "preview" : scripts.start ? "start" : null,
            buildCommand,
            devCommand,
            previewCommand,
            requiredBinaries: [...requiredBinaries],
            signals,
        };
    }

    private scoreCandidate(
        relativePath: string,
        candidateDir: string,
        packageJson: PackageJsonContent,
        framework: FrameworkInfo,
        packageManagerInfo: PackageManagerInfo,
    ): { score: number; reasons: string[] } {
        const reasons: string[] = [];
        let score = 0;

        const preferredPathScore = PREFERRED_PATH_SCORES[relativePath];
        if (preferredPathScore) {
            score += preferredPathScore;
            reasons.push(`matches preferred app path '${relativePath || "/"}' (+${preferredPathScore})`);
        }

        const scripts = packageJson.scripts ?? {};
        if (scripts.build) {
            score += 18;
            reasons.push("has a build script (+18)");
        }
        if (scripts.dev) {
            score += 16;
            reasons.push("has a dev script (+16)");
        }
        if (scripts.preview || scripts.start) {
            score += 8;
            reasons.push("has a preview/start script (+8)");
        }

        const frameworkScoreMap: Record<FrameworkType, number> = {
            nextjs: 42,
            vite: 38,
            "react-spa": 28,
            node: 10,
        };
        score += frameworkScoreMap[framework.framework];
        reasons.push(`framework '${framework.framework}' detected (+${frameworkScoreMap[framework.framework]})`);

        if (fs.existsSync(path.join(candidateDir, "src"))) {
            score += 10;
            reasons.push("contains src/ (+10)");
        }
        if (fs.existsSync(path.join(candidateDir, "app"))) {
            score += 8;
            reasons.push("contains app/ (+8)");
        }
        if (fs.existsSync(path.join(candidateDir, "pages"))) {
            score += 8;
            reasons.push("contains pages/ (+8)");
        }
        if (packageManagerInfo.detectedLockfile) {
            const lockfileScore = packageManagerInfo.installRoot === candidateDir ? 12 : 7;
            score += lockfileScore;
            reasons.push(
                `lockfile '${packageManagerInfo.detectedLockfile}' detected ${packageManagerInfo.installRoot === candidateDir ? "in app root" : "in ancestor workspace root"} (+${lockfileScore})`,
            );
        }

        if (packageJson.workspaces) {
            score -= 26;
            reasons.push("looks like a workspace root (-26)");
        }

        const packageName = packageJson.name?.toLowerCase() ?? "";
        if (packageName.includes("web") || packageName.includes("app") || packageName.includes("client")) {
            score += 6;
            reasons.push("package name suggests an app root (+6)");
        }

        const depth = relativePath ? relativePath.split("/").length : 0;
        if (depth > 3) {
            score -= 4;
            reasons.push("deeply nested package (-4)");
        }

        return { score, reasons };
    }

    private createGenericNodeFramework(): FrameworkInfo {
        return {
            framework: "node",
            runtime: "node",
            buildScriptName: null,
            devScriptName: null,
            previewScriptName: null,
            buildCommand: null,
            devCommand: null,
            previewCommand: null,
            requiredBinaries: [],
            signals: ["defaulted to generic Node app"],
        };
    }

    private toWorkspaceCandidate(candidate: CandidateInspection): WorkspaceCandidate {
        return {
            absolutePath: candidate.absolutePath,
            relativePath: candidate.relativePath,
            score: candidate.score,
            reasons: candidate.reasons,
            framework: candidate.framework.framework,
            packageManager: candidate.packageManagerInfo.packageManager,
            detectedLockfile: candidate.packageManagerInfo.detectedLockfile,
        };
    }

    private hasPackageJson(dir: string): boolean {
        return fs.existsSync(path.join(dir, "package.json"));
    }

    private readPackageJson(dir: string): PackageJsonContent | null {
        const packageJsonPath = path.join(dir, "package.json");
        if (!fs.existsSync(packageJsonPath)) {
            return null;
        }

        try {
            const raw = fs.readFileSync(packageJsonPath, "utf8");
            return JSON.parse(raw) as PackageJsonContent;
        } catch (error) {
            console.warn(`[WORKSPACE] Failed to parse package.json at ${packageJsonPath}:`, error);
            return null;
        }
    }

    private collectDependencies(packageJson: PackageJsonContent): Record<string, string> {
        return {
            ...(packageJson.dependencies ?? {}),
            ...(packageJson.devDependencies ?? {}),
        };
    }

    private detectBinariesFromCommands(commands: Array<string | null>): string[] {
        const binaries = new Set<string>();

        for (const command of commands) {
            if (!command) {
                continue;
            }

            const lowerCommand = command.toLowerCase();
            if (lowerCommand.includes("vite")) {
                binaries.add("vite");
            }
            if (lowerCommand.includes("next")) {
                binaries.add("next");
            }
            if (lowerCommand.includes("tsc")) {
                binaries.add("tsc");
            }
            if (lowerCommand.includes("react-scripts")) {
                binaries.add("react-scripts");
            }
        }

        return [...binaries];
    }

    private findNearestPackageJsonWithPackageManager(
        dir: string,
        repoRoot: string,
    ): { dir: string; packageManager: PackageManager } | null {
        let currentDir = dir;

        while (true) {
            const packageJson = this.readPackageJson(currentDir);
            const parsedPackageManager = this.parsePackageManager(packageJson?.packageManager);

            if (parsedPackageManager) {
                return {
                    dir: currentDir,
                    packageManager: parsedPackageManager,
                };
            }

            if (currentDir === repoRoot) {
                return null;
            }

            const parentDir = path.dirname(currentDir);
            if (parentDir === currentDir || !this.isWithinRoot(parentDir, repoRoot)) {
                return null;
            }

            currentDir = parentDir;
        }
    }

    private parsePackageManager(packageManagerField: string | undefined): PackageManager | null {
        if (!packageManagerField) {
            return null;
        }

        if (packageManagerField.startsWith("pnpm")) {
            return "pnpm";
        }
        if (packageManagerField.startsWith("yarn")) {
            return "yarn";
        }
        if (packageManagerField.startsWith("npm")) {
            return "npm";
        }

        return null;
    }

    private safeReadDir(dir: string): fs.Dirent[] | null {
        try {
            return fs.readdirSync(dir, { withFileTypes: true });
        } catch (error) {
            console.warn(`[WORKSPACE] Failed to read directory ${dir}:`, error);
            return null;
        }
    }

    private shouldTraverseDirectory(name: string): boolean {
        return !name.startsWith(".") && !EXCLUDED_DIRS.has(name);
    }

    private isWithinRoot(dir: string, repoRoot: string): boolean {
        const relative = path.relative(repoRoot, dir);
        return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
    }

    private toRelativePath(repoRoot: string, dir: string): string {
        const relative = path.relative(repoRoot, dir);
        return relative === "" ? "" : relative.split(path.sep).join("/");
    }

    private logWorkspaceAnalysis(analysis: WorkspaceAnalysis): void {
        console.log(`[WORKSPACE] Repo root: ${analysis.repoRoot}`);
        console.log(`[WORKSPACE] Detected app root: ${analysis.appRoot}`);
        console.log(`[WORKSPACE] Install root: ${analysis.installRoot}`);
        console.log(`[WORKSPACE] Detected framework: ${analysis.framework.framework}`);
        console.log(`[WORKSPACE] Detected package manager: ${analysis.packageManager}`);
        console.log(`[WORKSPACE] Detected lockfile: ${analysis.detectedLockfile ?? "none"}`);

        if (analysis.candidateRootsConsidered.length > 0) {
            console.log("[WORKSPACE] Candidate roots considered:");
            for (const candidate of analysis.candidateRootsConsidered) {
                console.log(
                    `  - ${candidate.relativePath || "/"} | score=${candidate.score} | framework=${candidate.framework} | packageManager=${candidate.packageManager} | lockfile=${candidate.detectedLockfile ?? "none"}`,
                );
            }
        }

        if (analysis.warnings.length > 0) {
            for (const warning of analysis.warnings) {
                console.warn(`[WORKSPACE] Warning: ${warning}`);
            }
        }
    }
}

export const workspaceService = new WorkspaceService();
