import { db } from '../db';
import { DuoFlowRun, DuoAgentInvocation, DuoAgentRole, DuoFlowStepKey } from '../../types';

export const gitlabDuoService = {
  async getFlowRunByTaskId(taskId: string): Promise<DuoFlowRun | undefined> {
    return db.duoFlowRuns.where('taskId').equals(taskId).first();
  },

  async createOrUpdateFlowRun(
    flowRun: Partial<DuoFlowRun> & { taskId: string; flowRunId: string; flowDefinitionId: string }
  ): Promise<string> {
    const existing = await this.getFlowRunByTaskId(flowRun.taskId);
    if (existing) {
      const updatedRun = { ...existing, ...flowRun, updatedAt: Date.now() };
      await db.duoFlowRuns.update(existing.id, updatedRun);
      return existing.id;
    } else {
      const newFlowRun: DuoFlowRun = {
        id: crypto.randomUUID(),
        taskId: flowRun.taskId,
        flowRunId: flowRun.flowRunId,
        flowDefinitionId: flowRun.flowDefinitionId,
        currentStepKey: flowRun.currentStepKey || 'inspect_ui_issue',
        status: flowRun.status || 'running',
        startedAt: Date.now(),
        updatedAt: Date.now(),
        ...flowRun
      } as DuoFlowRun;
      await db.duoFlowRuns.add(newFlowRun);
      return newFlowRun.id;
    }
  },

  async updateFlowStep(
    taskId: string,
    stepKey: DuoFlowStepKey,
    status: DuoFlowRun['status'] = 'running'
  ) {
      const existing = await this.getFlowRunByTaskId(taskId);
      if(existing) {
          await db.duoFlowRuns.update(existing.id, {
              currentStepKey: stepKey,
              status,
              updatedAt: Date.now()
          })
      }
  },

  async createAgentInvocation(
      flowRunId: string,
      taskId: string,
      agentRole: DuoAgentRole,
      stepKey: DuoFlowStepKey,
      metadata: Record<string, any> = {}
  ): Promise<string> {
      const id = crypto.randomUUID();
      await db.duoAgentInvocations.add({
          id,
          flowRunId,
          taskId,
          agentRole,
          stepKey,
          invocationStatus: 'running',
          metadata: JSON.stringify(metadata),
          startedAt: Date.now()
      });
      return id;
  },

  async completeAgentInvocation(id: string, success: boolean) {
      await db.duoAgentInvocations.update(id, {
          invocationStatus: success ? 'completed' : 'failed',
          completedAt: Date.now()
      });
  }
};
