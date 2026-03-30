import { BootstrapMetadata } from "./bootstrap.types";
import { commandService } from "./command.service";
import { workspaceService } from "./workspace.service";

export class BootstrapService {
    async prepareWorkspace(repoPath: string): Promise<BootstrapMetadata> {
        const analysis = await workspaceService.setupWorkspace(repoPath);
        const { commandPlan, toolingPreparation } = await commandService.prepareEnvironment(analysis.appRoot);

        const verificationChecks = [...toolingPreparation.verificationChecks];
        const warnings = [...analysis.warnings, ...toolingPreparation.warnings];
        const success = toolingPreparation.packageManagerBinaryReady;

        return {
            repoRoot: analysis.repoRoot,
            appRoot: analysis.appRoot,
            installRoot: analysis.installRoot,
            runtimeTargetUrl: this.resolveRuntimeTargetUrl(commandPlan.devCommandUsed, commandPlan.previewCommandUsed),
            framework: analysis.framework.framework,
            packageManager: analysis.packageManager,
            detectedLockfile: analysis.detectedLockfile,
            detectedLockfilePath: analysis.detectedLockfilePath,
            installCommandUsed: commandPlan.installCommandUsed,
            buildCommandUsed: commandPlan.buildCommandUsed,
            devCommandUsed: commandPlan.devCommandUsed,
            previewCommandUsed: commandPlan.previewCommandUsed,
            candidateRootsConsidered: analysis.candidateRootsConsidered,
            reasoning: analysis.reasoning,
            verificationChecks,
            warnings,
            success,
        };
    }

    private resolveRuntimeTargetUrl(
        devCommandUsed: string | null,
        previewCommandUsed: string | null,
    ): string {
        const command = devCommandUsed || previewCommandUsed || "";
        const portMatch =
            command.match(/--port\s+(\d{2,5})/) ||
            command.match(/--port=(\d{2,5})/) ||
            command.match(/(?:^|\s)-p\s+(\d{2,5})(?:\s|$)/);
        const port = portMatch?.[1] || "3000";

        return `http://127.0.0.1:${port}`;
    }
}

export const bootstrapService = new BootstrapService();
