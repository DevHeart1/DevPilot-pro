import { DuoFlowDefinition } from "../../../types";

export const devpilotFlow: DuoFlowDefinition = {
  id: "devpilot-standard-fix-flow",
  name: "DevPilot Standard Fix Flow",
  description: "A custom GitLab Duo Flow that inspects UI, generates patches, and verifies the sandbox result.",
  steps: [
    {
      key: "inspect_ui_issue",
      agentRole: "ui_inspector",
      description: "Analyze the current UI state against the target issue using Vision analysis."
    },
    {
      key: "normalize_findings",
      agentRole: "ui_inspector",
      description: "Normalize raw vision data into a structured fix recommendation."
    },
    {
      key: "infer_target_files",
      agentRole: "code_fixer",
      description: "Map visual elements to specific React component files in the repository."
    },
    {
      key: "generate_fix_recommendation",
      agentRole: "code_fixer",
      description: "Generate a targeted strategy based on previous memory and current inspection."
    },
    {
      key: "prepare_patch_proposal",
      agentRole: "code_fixer",
      description: "Create standard patch files and apply them to the sandbox."
    },
    {
      key: "wait_for_approval",
      agentRole: "system",
      description: "Wait for human or system approval to proceed with GitLab handoff.",
      isApprovalCheckpoint: true
    },
    {
      key: "handoff_to_gitlab",
      agentRole: "system",
      description: "Create branch and Merge Request in GitLab based on approved patch."
    },
    {
      key: "apply_repository_mutation",
      agentRole: "system",
      description: "Apply real repository mutations including commits and branch creation."
    },
    {
      key: "monitor_pipeline",
      agentRole: "system",
      description: "Monitor the CI/CD pipeline for the newly created Merge Request."
    },
    {
      key: "verify_fix",
      agentRole: "verifier",
      description: "Compare sandbox pre-patch and post-patch UI states for regressions."
    },
    {
      key: "finalize_task",
      agentRole: "system",
      description: "Close out the flow, store relevant workflow memories, and cleanup."
    }
  ]
};
