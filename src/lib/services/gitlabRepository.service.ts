import { db } from '../db';
import { GitLabRepositoryAction, GitLabMergeRequestRecord, GitLabPipelineRecord } from '../../types';

// ─── GitLab Repository Service ──────────────────────────────────────────────
// Dexie CRUD layer for repository action results, MR records, and pipeline records.

export const gitlabRepositoryService = {

    // ── Repository Actions ────────────────────────────────────────────────

    async createRepositoryAction(
        action: Omit<GitLabRepositoryAction, 'id'>
    ): Promise<string> {
        const id = crypto.randomUUID();
        await db.gitlabRepositoryActions.add({ ...action, id });
        return id;
    },

    async updateRepositoryAction(
        id: string,
        data: Partial<GitLabRepositoryAction>
    ): Promise<void> {
        await db.gitlabRepositoryActions.update(id, { ...data, updatedAt: Date.now() });
    },

    async getActionsForTask(taskId: string): Promise<GitLabRepositoryAction[]> {
        return db.gitlabRepositoryActions.where('taskId').equals(taskId).toArray();
    },

    async getActionsByProposal(proposalId: string): Promise<GitLabRepositoryAction[]> {
        return db.gitlabRepositoryActions.where('proposalId').equals(proposalId).toArray();
    },

    // ── Merge Request Records ─────────────────────────────────────────────

    async createMergeRequestRecord(
        record: Omit<GitLabMergeRequestRecord, 'id'>
    ): Promise<string> {
        const id = crypto.randomUUID();
        await db.gitlabMergeRequestRecords.add({ ...record, id });
        return id;
    },

    async updateMergeRequestRecord(
        id: string,
        data: Partial<GitLabMergeRequestRecord>
    ): Promise<void> {
        await db.gitlabMergeRequestRecords.update(id, { ...data, updatedAt: Date.now() });
    },

    async getMRRecordForTask(taskId: string): Promise<GitLabMergeRequestRecord | undefined> {
        return db.gitlabMergeRequestRecords.where('taskId').equals(taskId).first();
    },

    async getMRRecordByIid(mergeRequestIid: number): Promise<GitLabMergeRequestRecord | undefined> {
        return db.gitlabMergeRequestRecords.where('mergeRequestIid').equals(mergeRequestIid).first();
    },

    // ── Pipeline Records ──────────────────────────────────────────────────

    async createPipelineRecord(
        record: Omit<GitLabPipelineRecord, 'id'>
    ): Promise<string> {
        const id = crypto.randomUUID();
        await db.gitlabPipelineRecords.add({ ...record, id });
        return id;
    },

    async updatePipelineRecord(
        id: string,
        data: Partial<GitLabPipelineRecord>
    ): Promise<void> {
        await db.gitlabPipelineRecords.update(id, { ...data, updatedAt: Date.now() });
    },

    async getPipelineRecordForTask(taskId: string): Promise<GitLabPipelineRecord | undefined> {
        return db.gitlabPipelineRecords.where('taskId').equals(taskId).first();
    },

    async getPipelineRecordById(pipelineId: number): Promise<GitLabPipelineRecord | undefined> {
        return db.gitlabPipelineRecords.where('pipelineId').equals(pipelineId).first();
    },
};
