import { GitLabWebhookEvent } from '../../types';
import { taskService } from './index';
import { runService } from './run.service';
import { gitlabDuoService } from './gitlabDuo.service';
import { gitlabRepositoryService } from './gitlabRepository.service';

// ─── GitLab Event Router Service ────────────────────────────────────────────
// Routes incoming GitLab-style events to the correct handlers.
// Updates Dexie records, appends AgentMessages, emits AgentEvents,
// and advances DuoFlowRun / AgentRun state.

export const gitlabEventRouterService = {

    /**
     * Main entry point — routes a GitLabWebhookEvent to the appropriate handler.
     */
    async routeEvent(event: GitLabWebhookEvent): Promise<void> {
        console.log(`[EventRouter] Routing ${event.kind}:${event.action} (task: ${event.taskId ?? 'unknown'})`);

        // Emit a raw event-received record
        if (event.taskId) {
            await runService.createAgentEvent({
                taskId: event.taskId,
                source: 'gitlab_event_router',
                type: 'WEBHOOK_EVENT_RECEIVED',
                title: `GitLab Event: ${event.kind} ${event.action}`,
                description: `Received ${event.kind} event with action "${event.action}".`,
                metadata: JSON.stringify({ eventId: event.id, kind: event.kind, action: event.action, mergeRequestIid: event.mergeRequestIid, pipelineId: event.pipelineId }),
                timestamp: Date.now(),
            });
        }

        if (event.kind === 'merge_request') {
            await this.handleMergeRequestEvent(event);
        } else if (event.kind === 'pipeline') {
            await this.handlePipelineEvent(event);
        } else {
            console.warn(`[EventRouter] Unhandled event kind: ${event.kind}`);
        }
    },

    // ── MR Event Handlers ─────────────────────────────────────────────────

    async handleMergeRequestEvent(event: GitLabWebhookEvent): Promise<void> {
        if (!event.taskId || !event.mergeRequestIid) return;
        const taskId = event.taskId;

        const mrRecord = await gitlabRepositoryService.getMRRecordForTask(taskId);

        switch (event.action) {
            case 'open': {
                await taskService.appendAgentMessage({
                    taskId,
                    sender: 'system',
                    content: `Merge Request !${event.mergeRequestIid} opened.`,
                    kind: 'info',
                    timestamp: Date.now(),
                });
                if (mrRecord) {
                    await gitlabRepositoryService.updateMergeRequestRecord(mrRecord.id, { status: 'opened' });
                }
                break;
            }

            case 'approved': {
                await taskService.appendAgentMessage({
                    taskId,
                    sender: 'system',
                    content: `Merge Request !${event.mergeRequestIid} has been approved.`,
                    kind: 'success',
                    timestamp: Date.now(),
                });
                if (mrRecord) {
                    await gitlabRepositoryService.updateMergeRequestRecord(mrRecord.id, { status: 'opened', approvedAt: Date.now() });
                }
                // Record approval checkpoint in Duo flow
                await gitlabDuoService.updateFlowStep(taskId, 'handoff_to_gitlab', 'running');
                await runService.createAgentEvent({
                    taskId,
                    source: 'gitlab_event_router',
                    type: 'STATUS_CHANGED',
                    title: 'MR Approval Checkpoint',
                    description: `MR !${event.mergeRequestIid} approved — handoff checkpoint recorded.`,
                    metadata: JSON.stringify({ mergeRequestIid: event.mergeRequestIid }),
                    timestamp: Date.now(),
                });
                break;
            }

            case 'merge': {
                await taskService.appendAgentMessage({
                    taskId,
                    sender: 'system',
                    content: `Merge Request !${event.mergeRequestIid} has been merged! Handoff success.`,
                    kind: 'success',
                    timestamp: Date.now(),
                });
                if (mrRecord) {
                    await gitlabRepositoryService.updateMergeRequestRecord(mrRecord.id, { status: 'merged', mergedAt: Date.now() });
                }
                // Update DuoHandoffState concept via flow step
                await gitlabDuoService.updateFlowStep(taskId, 'verify_fix', 'running');
                await runService.createAgentEvent({
                    taskId,
                    source: 'gitlab_event_router',
                    type: 'STATUS_CHANGED',
                    title: 'Handoff Complete',
                    description: 'MR merged — advancing to verification.',
                    metadata: '{}',
                    timestamp: Date.now(),
                });
                break;
            }

            case 'close': {
                await taskService.appendAgentMessage({
                    taskId,
                    sender: 'system',
                    content: `Merge Request !${event.mergeRequestIid} was closed without merging.`,
                    kind: 'warning',
                    timestamp: Date.now(),
                });
                if (mrRecord) {
                    await gitlabRepositoryService.updateMergeRequestRecord(mrRecord.id, { status: 'closed' });
                }
                break;
            }

            default:
                console.log(`[EventRouter] Unhandled MR action: ${event.action}`);
        }
    },

    // ── Pipeline Event Handlers ───────────────────────────────────────────

    async handlePipelineEvent(event: GitLabWebhookEvent): Promise<void> {
        if (!event.taskId || !event.pipelineId) return;
        const taskId = event.taskId;

        const pipelineRecord = await gitlabRepositoryService.getPipelineRecordForTask(taskId);

        switch (event.action) {
            case 'started': {
                await taskService.appendAgentMessage({
                    taskId,
                    sender: 'system',
                    content: `Pipeline #${event.pipelineId} started.`,
                    kind: 'info',
                    timestamp: Date.now(),
                });
                if (pipelineRecord) {
                    await gitlabRepositoryService.updatePipelineRecord(pipelineRecord.id, { status: 'running' });
                }
                // Update Duo flow to monitor_pipeline
                await gitlabDuoService.updateFlowStep(taskId, 'monitor_pipeline', 'running');
                break;
            }

            case 'succeeded': {
                await taskService.appendAgentMessage({
                    taskId,
                    sender: 'system',
                    content: `Pipeline #${event.pipelineId} succeeded! ✓`,
                    kind: 'success',
                    timestamp: Date.now(),
                });
                if (pipelineRecord) {
                    await gitlabRepositoryService.updatePipelineRecord(pipelineRecord.id, { status: 'success' });
                }
                await runService.createAgentEvent({
                    taskId,
                    source: 'gitlab_event_router',
                    type: 'REPOSITORY_ACTION',
                    title: 'Pipeline Passed',
                    description: `Pipeline #${event.pipelineId} passed — repository execution state updated.`,
                    metadata: JSON.stringify({ pipelineId: event.pipelineId }),
                    timestamp: Date.now(),
                });
                break;
            }

            case 'failed': {
                await taskService.appendAgentMessage({
                    taskId,
                    sender: 'system',
                    content: `Pipeline #${event.pipelineId} failed. Task remains open for follow-up.`,
                    kind: 'warning',
                    timestamp: Date.now(),
                });
                if (pipelineRecord) {
                    await gitlabRepositoryService.updatePipelineRecord(pipelineRecord.id, { status: 'failed' });
                }
                await runService.createAgentEvent({
                    taskId,
                    source: 'gitlab_event_router',
                    type: 'REPOSITORY_ACTION',
                    title: 'Pipeline Failed',
                    description: `Pipeline #${event.pipelineId} failed — task kept open.`,
                    metadata: JSON.stringify({ pipelineId: event.pipelineId }),
                    timestamp: Date.now(),
                });
                break;
            }

            case 'canceled': {
                await taskService.appendAgentMessage({
                    taskId,
                    sender: 'system',
                    content: `Pipeline #${event.pipelineId} was canceled.`,
                    kind: 'warning',
                    timestamp: Date.now(),
                });
                if (pipelineRecord) {
                    await gitlabRepositoryService.updatePipelineRecord(pipelineRecord.id, { status: 'canceled' });
                }
                break;
            }

            default:
                console.log(`[EventRouter] Unhandled pipeline action: ${event.action}`);
        }
    },
};
