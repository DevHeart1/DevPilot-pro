import { db } from "../db";
import { ApprovalRequest } from "../../types";

export const pendingApprovalService = {
  async getApprovalRequests(): Promise<ApprovalRequest[]> {
    return (await db.approvalRequests.toArray()).sort(
      (left, right) => right.requestedAt - left.requestedAt,
    );
  },

  async getApprovalRequestsForTask(taskId: string): Promise<ApprovalRequest[]> {
    return (await db.approvalRequests.where("taskId").equals(taskId).toArray()).sort(
      (left, right) => right.requestedAt - left.requestedAt,
    );
  },

  async replaceApprovalRequests(requests: ApprovalRequest[]): Promise<void> {
    await db.transaction("rw", db.approvalRequests, async () => {
      await db.approvalRequests.clear();
      if (requests.length > 0) {
        await db.approvalRequests.bulkPut(requests);
      }
    });
  },

  async upsertApprovalRequest(request: ApprovalRequest): Promise<ApprovalRequest> {
    await db.approvalRequests.put(request);
    return request;
  },
};
