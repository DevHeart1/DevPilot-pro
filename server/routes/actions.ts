import express, { Request, Response } from "express";
import {
  createPendingActionForSession,
  executePendingActionForSession,
  updatePendingActionForSession,
} from "../services/delegatedAction.service";
import {
  DelegatedActionPreviewInput,
  PendingDelegatedActionUpdate,
} from "../../src/types";
import { RuntimeEnv, RuntimeSessionRecord } from "../runtime.types";
import { getPendingActionForSession } from "../runtime.store";

export function createActionsRouter(options: {
  env: RuntimeEnv;
  getSession: (request: Request, response: Response) => RuntimeSessionRecord;
}): express.Router {
  const router = express.Router();

  router.post("/api/secure-runtime/pending-actions/preview", (request, response) => {
    const session = options.getSession(request, response);
    const input = validatePreviewInput(request.body);
    const action = createPendingActionForSession({
      env: options.env,
      sessionId: session.id,
      input,
    });
    response.status(201).json({ data: action });
  });

  router.patch("/api/secure-runtime/pending-actions/:id", (request, response) => {
    const session = options.getSession(request, response);
    const pendingAction = getPendingActionForSession(session.id, request.params.id);
    if (!pendingAction) {
      response.status(404).json({ error: "Pending delegated action not found." });
      return;
    }

    const updates = validatePendingActionUpdate(request.body);
    const nextAction = updatePendingActionForSession({
      sessionId: session.id,
      pendingAction,
      updates,
    });
    response.json({ data: nextAction });
  });

  router.post("/api/secure-runtime/pending-actions/:id/execute", async (request, response) => {
    const session = options.getSession(request, response);
    const pendingAction = getPendingActionForSession(session.id, request.params.id);
    if (!pendingAction) {
      response.status(404).json({ error: "Pending delegated action not found." });
      return;
    }

    const result = await executePendingActionForSession({
      env: options.env,
      session,
      pendingAction,
    });
    const statusCode =
      result.ok ? 200 : result.execution.status === "blocked" ? 409 : 202;
    response.status(statusCode).json({ data: result });
  });

  return router;
}

function validatePreviewInput(body: unknown): DelegatedActionPreviewInput {
  const value = body as Partial<DelegatedActionPreviewInput> | null;
  if (!value || typeof value !== "object") {
    throw new Error("Delegated action preview payload is required.");
  }

  if (!value.provider || typeof value.provider !== "string") {
    throw new Error("provider is required.");
  }

  if (!value.actionKey || typeof value.actionKey !== "string") {
    throw new Error("actionKey is required.");
  }

  return {
    provider: value.provider as DelegatedActionPreviewInput["provider"],
    actionKey: value.actionKey,
    taskId: typeof value.taskId === "string" ? value.taskId : undefined,
    title: typeof value.title === "string" ? value.title : undefined,
    summary: typeof value.summary === "string" ? value.summary : undefined,
    metadata:
      value.metadata && typeof value.metadata === "object"
        ? (value.metadata as DelegatedActionPreviewInput["metadata"])
        : undefined,
  };
}

function validatePendingActionUpdate(body: unknown): PendingDelegatedActionUpdate {
  const value = body as PendingDelegatedActionUpdate | null;
  if (!value || typeof value !== "object") {
    throw new Error("Pending action update payload is required.");
  }

  return {
    approvalStatus: value.approvalStatus,
    stepUpStatus: value.stepUpStatus,
  };
}
