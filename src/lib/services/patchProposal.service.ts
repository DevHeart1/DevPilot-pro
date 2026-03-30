import { db } from '../db';
import { PatchProposal, PatchFile, VerificationPlan } from '../../types';

export const patchProposalService = {
  async getPatchProposalById(id: string): Promise<PatchProposal | undefined> {
    return await db.patchProposals.get(id);
  },

  async getLatestProposalForTask(taskId: string): Promise<PatchProposal | undefined> {
    const proposals = await db.patchProposals
      .where('taskId').equals(taskId)
      .reverse()
      .sortBy('createdAt');
    return proposals[0];
  },

  async createPatchProposal(proposal: PatchProposal): Promise<string> {
    await db.patchProposals.add(proposal);
    return proposal.id;
  },

  async updatePatchProposalStatus(id: string, status: PatchProposal['status']): Promise<void> {
    await db.patchProposals.update(id, { status, updatedAt: Date.now() });
  },

  async getPatchFilesForProposal(proposalId: string): Promise<PatchFile[]> {
    return await db.patchFiles
      .where('proposalId').equals(proposalId)
      .sortBy('createdAt');
  },

  async createPatchFile(file: PatchFile): Promise<string> {
    await db.patchFiles.add(file);
    return file.id;
  },

  async createVerificationPlan(plan: VerificationPlan): Promise<string> {
    await db.verificationPlans.add(plan);
    return plan.id;
  },

  async getVerificationPlanForTask(taskId: string): Promise<VerificationPlan | undefined> {
    const plans = await db.verificationPlans
      .where('taskId').equals(taskId)
      .reverse()
      .sortBy('createdAt');
    return plans[0];
  }
};
