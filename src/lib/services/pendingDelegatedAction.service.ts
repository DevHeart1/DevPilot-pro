import { db } from "../db";
import {
  PendingDelegatedAction,
  PendingDelegatedActionUpdate,
} from "../../types";

export const pendingDelegatedActionService = {
  async getPendingActions(): Promise<PendingDelegatedAction[]> {
    return (await db.pendingDelegatedActions.toArray()).sort(
      (left, right) => right.updatedAt - left.updatedAt,
    );
  },

  async getPendingActionsForTask(
    taskId: string,
  ): Promise<PendingDelegatedAction[]> {
    return (await db.pendingDelegatedActions.where("taskId").equals(taskId).toArray()).sort(
      (left, right) => right.updatedAt - left.updatedAt,
    );
  },

  async replacePendingActions(
    actions: PendingDelegatedAction[],
  ): Promise<void> {
    await db.transaction("rw", db.pendingDelegatedActions, async () => {
      await db.pendingDelegatedActions.clear();
      if (actions.length > 0) {
        await db.pendingDelegatedActions.bulkPut(actions);
      }
    });
  },

  async upsertPendingAction(
    action: PendingDelegatedAction,
  ): Promise<PendingDelegatedAction> {
    const record = {
      ...action,
      updatedAt: Date.now(),
    };
    await db.pendingDelegatedActions.put(record);
    return record;
  },

  async updatePendingAction(
    id: string,
    updates: PendingDelegatedActionUpdate,
  ): Promise<PendingDelegatedAction | undefined> {
    const existing = await db.pendingDelegatedActions.get(id);
    if (!existing) {
      return undefined;
    }

    const nextRecord: PendingDelegatedAction = {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
    };

    await db.pendingDelegatedActions.put(nextRecord);
    return nextRecord;
  },
};
