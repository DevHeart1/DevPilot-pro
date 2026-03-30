import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";

const execAsync = promisify(exec);

export class GitService {
    /**
     * Clones a repository into the workspace.
     */
    async cloneRepo(gitlabUrl: string, branch: string, token?: string): Promise<string> {
        const workspaceDir = path.resolve(process.cwd(), "workspace");

        // Create workspace if it doesn't exist
        if (!fs.existsSync(workspaceDir)) {
            fs.mkdirSync(workspaceDir, { recursive: true });
        }

        // Cleanup existing content in workspace
        console.log(`[GIT] Cleaning workspace at ${workspaceDir}`);
        const items = fs.readdirSync(workspaceDir);
        for (const item of items) {
            fs.rmSync(path.join(workspaceDir, item), { recursive: true, force: true });
        }

        console.log(`[GIT] Cloning ${gitlabUrl} (branch: ${branch}) into ${workspaceDir}`);

        // Construct URL with token if provided
        let authenticatedUrl = gitlabUrl;
        if (token) {
            authenticatedUrl = gitlabUrl.replace("https://", `https://oauth2:${token}@`);
        }

        const command = `git clone --branch ${branch} --single-branch ${authenticatedUrl} .`;
        console.log(`[GIT] Clone command prepared for destination ${workspaceDir}`);

        try {
            await execAsync(command, { cwd: workspaceDir });
            console.log(`[GIT] Clone successful.`);
            return workspaceDir;
        } catch (error: any) {
            console.error(`[GIT] Clone failed:`, error.message);
            throw new Error(`Failed to clone repository: ${error.message}`);
        }
    }
}

export const gitService = new GitService();
