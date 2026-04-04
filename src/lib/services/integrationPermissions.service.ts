import { db } from "../db";
import {
  AuthSessionSnapshot,
  ConnectedIntegration,
  DelegatedActionPolicy,
  SecureRuntimeSnapshot,
} from "../../types";

const CURRENT_SESSION_ID = "current";

export const integrationPermissionsService = {
  async getSessionSnapshot(): Promise<AuthSessionSnapshot | undefined> {
    return db.authSessions.get(CURRENT_SESSION_ID);
  },

  async saveSessionSnapshot(
    session: AuthSessionSnapshot,
  ): Promise<AuthSessionSnapshot> {
    const record = {
      ...session,
      id: CURRENT_SESSION_ID,
      updatedAt: Date.now(),
    };
    await db.authSessions.put(record);
    return record;
  },

  async getConnectedIntegrations(): Promise<ConnectedIntegration[]> {
    return (await db.connectedIntegrations.toArray()).sort((left, right) =>
      left.displayName.localeCompare(right.displayName),
    );
  },

  async replaceConnectedIntegrations(
    integrations: ConnectedIntegration[],
  ): Promise<void> {
    await db.transaction("rw", db.connectedIntegrations, async () => {
      await db.connectedIntegrations.clear();
      if (integrations.length > 0) {
        await db.connectedIntegrations.bulkPut(integrations);
      }
    });
  },

  async getDelegatedActionPolicies(): Promise<DelegatedActionPolicy[]> {
    return (await db.delegatedActionPolicies.toArray()).sort((left, right) => {
      if (left.riskLevel === right.riskLevel) {
        return left.actionKey.localeCompare(right.actionKey);
      }

      return riskOrder(left.riskLevel) - riskOrder(right.riskLevel);
    });
  },

  async replaceDelegatedActionPolicies(
    policies: DelegatedActionPolicy[],
  ): Promise<void> {
    await db.transaction("rw", db.delegatedActionPolicies, async () => {
      await db.delegatedActionPolicies.clear();
      if (policies.length > 0) {
        await db.delegatedActionPolicies.bulkPut(policies);
      }
    });
  },

  async hydrateRuntimeSnapshot(
    snapshot: Pick<SecureRuntimeSnapshot, "session" | "integrations" | "policies">,
  ): Promise<void> {
    await db.transaction(
      "rw",
      [db.authSessions, db.connectedIntegrations, db.delegatedActionPolicies],
      async () => {
        await db.authSessions.clear();
        await db.authSessions.put({
          ...snapshot.session,
          id: CURRENT_SESSION_ID,
        });

        await db.connectedIntegrations.clear();
        if (snapshot.integrations.length > 0) {
          await db.connectedIntegrations.bulkPut(snapshot.integrations);
        }

        await db.delegatedActionPolicies.clear();
        if (snapshot.policies.length > 0) {
          await db.delegatedActionPolicies.bulkPut(snapshot.policies);
        }
      },
    );
  },
};

function riskOrder(riskLevel: DelegatedActionPolicy["riskLevel"]): number {
  switch (riskLevel) {
    case "low":
      return 0;
    case "medium":
      return 1;
    case "high":
      return 2;
    default:
      return 3;
  }
}
