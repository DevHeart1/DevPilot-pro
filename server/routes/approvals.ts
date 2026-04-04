import express, { Request, Response } from "express";
import {
  approveApprovalRequestForSession,
  rejectApprovalRequestForSession,
} from "../services/approval.service";
import {
  completeStepUpRequirementForSession,
  startStepUpRequirementForSession,
} from "../services/stepUpAuth.service";
import { RuntimeEnv, RuntimeSessionRecord } from "../runtime.types";

export function createApprovalsRouter(options: {
  env: RuntimeEnv;
  getSession: (request: Request, response: Response) => RuntimeSessionRecord;
}): express.Router {
  const router = express.Router();

  router.post("/api/secure-runtime/approvals/:id/approve", (request, response) => {
    const session = options.getSession(request, response);
    const result = approveApprovalRequestForSession({
      sessionId: session.id,
      approvalRequestId: request.params.id,
    });
    response.json({ data: result });
  });

  router.post("/api/secure-runtime/approvals/:id/reject", (request, response) => {
    const session = options.getSession(request, response);
    const result = rejectApprovalRequestForSession({
      sessionId: session.id,
      approvalRequestId: request.params.id,
    });
    response.json({ data: result });
  });

  router.post("/api/secure-runtime/step-up/:id/start", (request, response) => {
    const session = options.getSession(request, response);
    const result = startStepUpRequirementForSession({
      env: options.env,
      sessionId: session.id,
      stepUpRequirementId: request.params.id,
    });
    response.json({ data: result });
  });

  router.post("/api/secure-runtime/step-up/:id/complete", (request, response) => {
    const session = options.getSession(request, response);
    const result = completeStepUpRequirementForSession({
      sessionId: session.id,
      stepUpRequirementId: request.params.id,
    });
    response.json({ data: result });
  });

  return router;
}
