import Dexie, { Table } from 'dexie';
import {
  AgentEvent,
  AgentMessage,
  AgentRun,
  AuthSessionSnapshot,
  ApprovalRequest,
  CodeReviewBatch,
  CodeReviewIssue,
  ConnectedIntegration,
  DelegatedActionPolicy,
  DelegatedActionExecution,
  DuoAgentInvocation,
  DuoFlowRun,
  GitLabMergeRequestRecord,
  GitLabPipelineRecord,
  GitLabRepositoryAction,
  Memory,
  PatchFile,
  PatchProposal,
  PendingDelegatedAction,
  RunStep,
  StepUpRequirement,
  Task,
  TaskArtifact,
  TaskMemoryHit,
  VerificationEvidence,
  VerificationPlan,
  VerificationResult,
} from '../../types';

export class DevPilotDB extends Dexie {
  tasks!: Table<Task>;
  agentMessages!: Table<AgentMessage>;
  taskArtifacts!: Table<TaskArtifact>;
  memories!: Table<Memory>;
  agentRuns!: Table<AgentRun>;
  agentEvents!: Table<AgentEvent>;
  runSteps!: Table<RunStep>;
  taskMemoryHits!: Table<TaskMemoryHit>;
  patchProposals!: Table<PatchProposal>;
  patchFiles!: Table<PatchFile>;
  verificationPlans!: Table<VerificationPlan>;
  verificationResults!: Table<VerificationResult>;
  verificationEvidences!: Table<VerificationEvidence>;
  duoFlowRuns!: Table<DuoFlowRun>;
  duoAgentInvocations!: Table<DuoAgentInvocation>;
  gitlabRepositoryActions!: Table<GitLabRepositoryAction>;
  gitlabMergeRequestRecords!: Table<GitLabMergeRequestRecord>;
  gitlabPipelineRecords!: Table<GitLabPipelineRecord>;
  codeReviewIssues!: Table<CodeReviewIssue>;
  codeReviewBatches!: Table<CodeReviewBatch>;
  authSessions!: Table<AuthSessionSnapshot>;
  connectedIntegrations!: Table<ConnectedIntegration>;
  delegatedActionPolicies!: Table<DelegatedActionPolicy>;
  pendingDelegatedActions!: Table<PendingDelegatedAction>;
  delegatedActionExecutions!: Table<DelegatedActionExecution>;
  approvalRequests!: Table<ApprovalRequest>;
  stepUpRequirements!: Table<StepUpRequirement>;

  constructor() {
    super('DevPilotDB');
    this.version(1).stores({
      tasks: 'id, category, status, createdAt',
      agentMessages: 'id, taskId, timestamp',
      taskArtifacts: 'id, [taskId+type]',
      memories: 'id, scope, createdAt',
      agentRuns: 'id, taskId, status'
    });

    this.version(2).stores({
      tasks: 'id, category, status, createdAt',
      agentMessages: 'id, taskId, timestamp',
      taskArtifacts: 'id, [taskId+type]',
      memories: 'id, scope, createdAt',
      agentRuns: 'id, taskId, status',
      agentEvents: 'id, taskId, timestamp',
      runSteps: 'id, runId, taskId, order',
      taskMemoryHits: 'id, taskId, memoryId'
    }).upgrade(tx => {
      return tx.table('tasks').toCollection().modify(task => {
        // Migration logic if any
      });
    });

    this.version(7).stores({
      tasks: 'id, category, status, createdAt',
      agentMessages: 'id, taskId, timestamp',
      taskArtifacts: 'id, [taskId+type]',
      memories: 'id, scope, createdAt',
      agentRuns: 'id, taskId, status',
      agentEvents: 'id, taskId, timestamp',
      runSteps: 'id, runId, taskId, order',
      taskMemoryHits: 'id, taskId, memoryId',
      patchProposals: 'id, taskId, status',
      patchFiles: 'id, proposalId, taskId',
      verificationPlans: 'id, taskId, proposalId',
      verificationResults: 'id, taskId, proposalId, status',
      verificationEvidences: 'id, verificationResultId, taskId, type',
      duoFlowRuns: 'id, taskId, flowRunId, flowDefinitionId, status, createdAt',
      duoAgentInvocations: 'id, flowRunId, taskId, agentRole, stepKey, invocationStatus'
    }).upgrade(tx => {
      return tx.table('agentRuns').toCollection().modify(run => {
        run.progress = run.progress ?? 0;
        run.totalSteps = run.totalSteps ?? 0;
        run.completedSteps = run.completedSteps ?? 0;
        run.mode = run.mode ?? 'mock';
      });
    });

    this.version(8).stores({
      tasks: 'id, category, status, createdAt',
      agentMessages: 'id, taskId, timestamp',
      taskArtifacts: 'id, [taskId+type]',
      memories: 'id, scope, createdAt',
      agentRuns: 'id, taskId, status',
      agentEvents: 'id, taskId, timestamp',
      runSteps: 'id, runId, taskId, order',
      taskMemoryHits: 'id, taskId, memoryId',
      patchProposals: 'id, taskId, status',
      patchFiles: 'id, proposalId, taskId',
      verificationPlans: 'id, taskId, proposalId',
      verificationResults: 'id, taskId, proposalId, status',
      verificationEvidences: 'id, verificationResultId, taskId, type',
      duoFlowRuns: 'id, taskId, flowRunId, flowDefinitionId, status, createdAt',
      duoAgentInvocations: 'id, flowRunId, taskId, agentRole, stepKey, invocationStatus',
      gitlabRepositoryActions: 'id, taskId, proposalId, actionType, status',
      gitlabMergeRequestRecords: 'id, taskId, proposalId, mergeRequestIid',
      gitlabPipelineRecords: 'id, taskId, proposalId, pipelineId, status'
    });

    this.version(9).stores({
      tasks: 'id, category, status, createdAt',
      agentMessages: 'id, taskId, timestamp',
      taskArtifacts: 'id, [taskId+type]',
      memories: 'id, scope, createdAt',
      agentRuns: 'id, taskId, status',
      agentEvents: 'id, taskId, timestamp',
      runSteps: 'id, runId, taskId, order',
      taskMemoryHits: 'id, taskId, memoryId',
      patchProposals: 'id, taskId, status',
      patchFiles: 'id, proposalId, taskId',
      verificationPlans: 'id, taskId, proposalId',
      verificationResults: 'id, taskId, proposalId, status',
      verificationEvidences: 'id, verificationResultId, taskId, type',
      duoFlowRuns: 'id, taskId, flowRunId, flowDefinitionId, status, createdAt',
      duoAgentInvocations: 'id, flowRunId, taskId, agentRole, stepKey, invocationStatus',
      gitlabRepositoryActions: 'id, taskId, proposalId, actionType, status',
      gitlabMergeRequestRecords: 'id, taskId, proposalId, mergeRequestIid',
      gitlabPipelineRecords: 'id, taskId, proposalId, pipelineId, status'
    }).upgrade(async tx => {
      await tx.table('agentRuns').toCollection().modify(run => {
        if (run.mode === 'mock') {
          run.mode = 'live';
        }
      });

      await tx.table('patchProposals').toCollection().modify(proposal => {
        if (proposal.source === 'mock_code_agent') {
          proposal.source = 'gemini_code_agent';
        }
      });
    });

    this.version(3).stores({
      tasks: 'id, category, status, createdAt',
      agentMessages: 'id, taskId, timestamp',
      taskArtifacts: 'id, [taskId+type]',
      memories: 'id, scope, createdAt',
      agentRuns: 'id, taskId, status',
      agentEvents: 'id, taskId, timestamp',
      runSteps: 'id, runId, taskId, order',
      taskMemoryHits: 'id, taskId, memoryId'
    }).upgrade(tx => {
      return tx.table('tasks').toCollection().modify(task => {
        task.inspectionStatus = task.inspectionStatus || "idle";
      });
    });

    this.version(4).stores({
      tasks: 'id, category, status, createdAt',
      agentMessages: 'id, taskId, timestamp',
      taskArtifacts: 'id, [taskId+type]',
      memories: 'id, scope, createdAt',
      agentRuns: 'id, taskId, status',
      agentEvents: 'id, taskId, timestamp',
      runSteps: 'id, runId, taskId, order',
      taskMemoryHits: 'id, taskId, memoryId',
      patchProposals: 'id, taskId, status',
      patchFiles: 'id, proposalId, taskId',
      verificationPlans: 'id, taskId, proposalId'
    }).upgrade(tx => {
      return tx.table('tasks').toCollection().modify(task => {
        task.codeFixStatus = task.codeFixStatus || "idle";
      });
    });

    this.version(5).stores({
      tasks: 'id, category, status, createdAt',
      agentMessages: 'id, taskId, timestamp',
      taskArtifacts: 'id, [taskId+type]',
      memories: 'id, scope, createdAt',
      agentRuns: 'id, taskId, status',
      agentEvents: 'id, taskId, timestamp',
      runSteps: 'id, runId, taskId, order',
      taskMemoryHits: 'id, taskId, memoryId',
      patchProposals: 'id, taskId, status',
      patchFiles: 'id, proposalId, taskId',
      verificationPlans: 'id, taskId, proposalId',
      verificationResults: 'id, taskId, proposalId, status',
      verificationEvidences: 'id, verificationResultId, taskId, type'
    });

    this.version(10).stores({
      tasks: 'id, category, status, createdAt',
      agentMessages: 'id, taskId, timestamp',
      taskArtifacts: 'id, [taskId+type]',
      memories: 'id, scope, createdAt',
      agentRuns: 'id, taskId, status',
      agentEvents: 'id, taskId, timestamp',
      runSteps: 'id, runId, taskId, order',
      taskMemoryHits: 'id, taskId, memoryId',
      patchProposals: 'id, taskId, status',
      patchFiles: 'id, proposalId, taskId',
      verificationPlans: 'id, taskId, proposalId',
      verificationResults: 'id, taskId, proposalId, status',
      verificationEvidences: 'id, verificationResultId, taskId, type',
      duoFlowRuns: 'id, taskId, flowRunId, flowDefinitionId, status, createdAt',
      duoAgentInvocations: 'id, flowRunId, taskId, agentRole, stepKey, invocationStatus',
      gitlabRepositoryActions: 'id, taskId, proposalId, actionType, status',
      gitlabMergeRequestRecords: 'id, taskId, proposalId, mergeRequestIid',
      gitlabPipelineRecords: 'id, taskId, proposalId, pipelineId, status',
      codeReviewIssues: 'id, status, category, source, repo, branch, score, createdAt, updatedAt, dedupeKey, linkedTaskId, [repo+branch], [repo+branch+category]',
      codeReviewBatches: 'id, repo, branch, discoveryMode, createdAt, updatedAt, [repo+branch]'
    });

    this.version(11).stores({
      tasks: 'id, category, status, createdAt',
      agentMessages: 'id, taskId, timestamp',
      taskArtifacts: 'id, [taskId+type]',
      memories: 'id, scope, createdAt',
      agentRuns: 'id, taskId, status',
      agentEvents: 'id, taskId, timestamp',
      runSteps: 'id, runId, taskId, order',
      taskMemoryHits: 'id, taskId, memoryId',
      patchProposals: 'id, taskId, status',
      patchFiles: 'id, proposalId, taskId',
      verificationPlans: 'id, taskId, proposalId',
      verificationResults: 'id, taskId, proposalId, status',
      verificationEvidences: 'id, verificationResultId, taskId, type',
      duoFlowRuns: 'id, taskId, flowRunId, flowDefinitionId, status, createdAt',
      duoAgentInvocations: 'id, flowRunId, taskId, agentRole, stepKey, invocationStatus',
      gitlabRepositoryActions: 'id, taskId, proposalId, actionType, status',
      gitlabMergeRequestRecords: 'id, taskId, proposalId, mergeRequestIid',
      gitlabPipelineRecords: 'id, taskId, proposalId, pipelineId, status',
      codeReviewIssues: 'id, status, category, source, repo, branch, score, createdAt, updatedAt, dedupeKey, linkedTaskId, [repo+branch], [repo+branch+category]',
      codeReviewBatches: 'id, repo, branch, discoveryMode, createdAt, updatedAt, [repo+branch]',
      authSessions: 'id, status, runtimeMode, updatedAt',
      connectedIntegrations: 'id, provider, status, source, updatedAt',
      delegatedActionPolicies: 'id, provider, actionKey, riskLevel',
      pendingDelegatedActions: 'id, taskId, provider, actionKey, riskLevel, approvalStatus, stepUpStatus, updatedAt, [provider+actionKey]'
    });

    this.version(12).stores({
      tasks: 'id, category, status, createdAt',
      agentMessages: 'id, taskId, timestamp',
      taskArtifacts: 'id, [taskId+type]',
      memories: 'id, scope, createdAt',
      agentRuns: 'id, taskId, status',
      agentEvents: 'id, taskId, timestamp',
      runSteps: 'id, runId, taskId, order',
      taskMemoryHits: 'id, taskId, memoryId',
      patchProposals: 'id, taskId, status',
      patchFiles: 'id, proposalId, taskId',
      verificationPlans: 'id, taskId, proposalId',
      verificationResults: 'id, taskId, proposalId, status',
      verificationEvidences: 'id, verificationResultId, taskId, type',
      duoFlowRuns: 'id, taskId, flowRunId, flowDefinitionId, status, createdAt',
      duoAgentInvocations: 'id, flowRunId, taskId, agentRole, stepKey, invocationStatus',
      gitlabRepositoryActions: 'id, taskId, proposalId, actionType, status',
      gitlabMergeRequestRecords: 'id, taskId, proposalId, mergeRequestIid',
      gitlabPipelineRecords: 'id, taskId, proposalId, pipelineId, status',
      codeReviewIssues: 'id, status, category, source, repo, branch, score, createdAt, updatedAt, dedupeKey, linkedTaskId, [repo+branch], [repo+branch+category]',
      codeReviewBatches: 'id, repo, branch, discoveryMode, createdAt, updatedAt, [repo+branch]',
      authSessions: 'id, status, runtimeMode, updatedAt',
      connectedIntegrations: 'id, provider, status, source, updatedAt',
      delegatedActionPolicies: 'id, provider, actionKey, riskLevel',
      pendingDelegatedActions: 'id, taskId, provider, actionKey, riskLevel, approvalStatus, stepUpStatus, updatedAt, [provider+actionKey]',
      delegatedActionExecutions: 'id, taskId, provider, actionKey, status, mode, updatedAt, [provider+actionKey]'
    });

    this.version(13).stores({
      tasks: 'id, category, status, createdAt',
      agentMessages: 'id, taskId, timestamp',
      taskArtifacts: 'id, [taskId+type]',
      memories: 'id, scope, createdAt',
      agentRuns: 'id, taskId, status',
      agentEvents: 'id, taskId, timestamp',
      runSteps: 'id, runId, taskId, order',
      taskMemoryHits: 'id, taskId, memoryId',
      patchProposals: 'id, taskId, status',
      patchFiles: 'id, proposalId, taskId',
      verificationPlans: 'id, taskId, proposalId',
      verificationResults: 'id, taskId, proposalId, status',
      verificationEvidences: 'id, verificationResultId, taskId, type',
      duoFlowRuns: 'id, taskId, flowRunId, flowDefinitionId, status, createdAt',
      duoAgentInvocations: 'id, flowRunId, taskId, agentRole, stepKey, invocationStatus',
      gitlabRepositoryActions: 'id, taskId, proposalId, actionType, status',
      gitlabMergeRequestRecords: 'id, taskId, proposalId, mergeRequestIid',
      gitlabPipelineRecords: 'id, taskId, proposalId, pipelineId, status',
      codeReviewIssues: 'id, status, category, source, repo, branch, score, createdAt, updatedAt, dedupeKey, linkedTaskId, [repo+branch], [repo+branch+category]',
      codeReviewBatches: 'id, repo, branch, discoveryMode, createdAt, updatedAt, [repo+branch]',
      authSessions: 'id, status, runtimeMode, updatedAt',
      connectedIntegrations: 'id, provider, status, source, updatedAt',
      delegatedActionPolicies: 'id, provider, actionKey, riskLevel',
      pendingDelegatedActions: 'id, taskId, provider, actionKey, status, approvalStatus, stepUpStatus, updatedAt, [provider+actionKey]',
      delegatedActionExecutions: 'id, taskId, provider, actionKey, status, mode, updatedAt, [provider+actionKey]',
      approvalRequests: 'id, taskId, pendingActionId, provider, actionKey, status, requestedAt, expiresAt',
      stepUpRequirements: 'id, taskId, pendingActionId, provider, actionKey, status, updatedAt'
    });
  }
}

export const db = new DevPilotDB();
