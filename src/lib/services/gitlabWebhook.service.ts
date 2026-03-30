import { GitLabWebhookEvent } from '../../types';
import { config } from '../config/env';

// ─── GitLab Webhook Service ─────────────────────────────────────────────────
// Cloud Run-oriented webhook target architecture.
// Parses and verifies incoming GitLab webhook payloads,
// normalizing them into GitLabWebhookEvent for the event router.

// ─── Payload Types (minimal subset of real GitLab webhook payloads) ─────────

interface GitLabMRWebhookPayload {
    object_kind: 'merge_request';
    object_attributes: {
        iid: number;
        action: string;
        state: string;
        url: string;
        source_branch: string;
        target_branch: string;
        source: { id: number };
    };
    project: { id: number };
}

interface GitLabPipelineWebhookPayload {
    object_kind: 'pipeline';
    object_attributes: {
        id: number;
        ref: string;
        status: string;
    };
    project: { id: number; web_url: string };
}

type GitLabWebhookPayload = GitLabMRWebhookPayload | GitLabPipelineWebhookPayload;

// ─── Action Mapping ─────────────────────────────────────────────────────────

function mapMRAction(action: string, state: string): GitLabWebhookEvent['action'] {
    if (action === 'merge' || state === 'merged') return 'merge';
    if (action === 'approved') return 'approved';
    if (action === 'unapproved') return 'unapproved';
    if (action === 'close' || state === 'closed') return 'close';
    if (action === 'reopen') return 'reopen';
    if (action === 'open') return 'open';
    return 'update';
}

function mapPipelineAction(status: string): GitLabWebhookEvent['action'] {
    if (status === 'success') return 'succeeded';
    if (status === 'failed') return 'failed';
    if (status === 'canceled') return 'canceled';
    if (status === 'running') return 'started';
    return 'started';
}

// ─── Service ────────────────────────────────────────────────────────────────

export const gitlabWebhookService = {

    /**
     * Verifies the webhook signature using the shared secret.
     * GitLab uses the X-Gitlab-Token header (shared secret, not HMAC).
     * Returns true if verification passes or if no secret is configured.
     */
    verifyWebhookSignature(
        headers: Record<string, string | undefined>,
        _body: string
    ): boolean {
        const secret = config.webhookSecret;
        if (!secret) {
            // No secret configured — accept all payloads (dev/demo mode)
            return true;
        }
        const token = headers['x-gitlab-token'] || headers['X-Gitlab-Token'];
        return token === secret;
    },

    /**
     * Parses a raw GitLab webhook payload into a normalized GitLabWebhookEvent.
     * Returns null if the payload cannot be parsed.
     */
    parseWebhookPayload(
        body: string,
        taskIdResolver?: (projectId: number, ref?: string, mrIid?: number) => string | undefined
    ): GitLabWebhookEvent | null {
        let payload: GitLabWebhookPayload;
        try {
            payload = JSON.parse(body) as GitLabWebhookPayload;
        } catch {
            console.warn('[Webhook] Failed to parse webhook body as JSON.');
            return null;
        }

        if (payload.object_kind === 'merge_request') {
            const p = payload as GitLabMRWebhookPayload;
            const attrs = p.object_attributes;
            const taskId = taskIdResolver?.(p.project.id, attrs.source_branch, attrs.iid);
            return {
                id: crypto.randomUUID(),
                kind: 'merge_request',
                action: mapMRAction(attrs.action, attrs.state),
                taskId,
                mergeRequestIid: attrs.iid,
                ref: attrs.source_branch,
                webUrl: attrs.url,
                sourceProjectId: p.project.id,
                rawPayload: body,
                receivedAt: Date.now(),
            };
        }

        if (payload.object_kind === 'pipeline') {
            const p = payload as GitLabPipelineWebhookPayload;
            const attrs = p.object_attributes;
            const taskId = taskIdResolver?.(p.project.id, attrs.ref);
            return {
                id: crypto.randomUUID(),
                kind: 'pipeline',
                action: mapPipelineAction(attrs.status),
                taskId,
                pipelineId: attrs.id,
                ref: attrs.ref,
                webUrl: `${p.project.web_url}/-/pipelines/${attrs.id}`,
                sourceProjectId: p.project.id,
                rawPayload: body,
                receivedAt: Date.now(),
            };
        }

        console.warn(`[Webhook] Unsupported object_kind: ${(payload as { object_kind: string }).object_kind}`);
        return null;
    },

    /**
     * Creates a synthetic GitLabWebhookEvent for local/demo testing
     * without a real webhook payload.
     */
    createSyntheticEvent(
        kind: GitLabWebhookEvent['kind'],
        action: GitLabWebhookEvent['action'],
        opts: {
            taskId?: string;
            mergeRequestIid?: number;
            pipelineId?: number;
            ref?: string;
            webUrl?: string;
        } = {}
    ): GitLabWebhookEvent {
        return {
            id: crypto.randomUUID(),
            kind,
            action,
            taskId: opts.taskId,
            mergeRequestIid: opts.mergeRequestIid,
            pipelineId: opts.pipelineId,
            ref: opts.ref,
            webUrl: opts.webUrl,
            receivedAt: Date.now(),
        };
    },
};
