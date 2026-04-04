import { describe, expect, it } from "vitest";
import {
  createMockSecureRuntimeSnapshot,
  createPendingDelegatedAction,
  delegatedActionPolicies,
  getDelegatedActionPolicy,
} from "../lib/secure-actions/catalog";

describe("secure action catalog", () => {
  it("models high-risk delegated actions with approval and step-up", () => {
    const mergePolicy = getDelegatedActionPolicy("gitlab", "gitlab.merge_pr");

    expect(mergePolicy).toBeDefined();
    expect(mergePolicy?.riskLevel).toBe("high");
    expect(mergePolicy?.requiresApproval).toBe(true);
    expect(mergePolicy?.requiresStepUp).toBe(true);
  });

  it("creates pending previews from policy requirements", () => {
    const policy = getDelegatedActionPolicy("slack", "slack.post_status_message");
    expect(policy).toBeDefined();

    const preview = createPendingDelegatedAction(
      {
        provider: "slack",
        actionKey: "slack.post_status_message",
        title: "Preview Slack status update",
      },
      policy!,
      1234,
    );

    expect(preview.riskLevel).toBe("medium");
    expect(preview.approvalStatus).toBe("pending");
    expect(preview.stepUpStatus).toBe("not_required");
    expect(preview.requiredScopes).toEqual(policy?.allowedScopes);
  });

  it("provides a resilient mock runtime snapshot", () => {
    const snapshot = createMockSecureRuntimeSnapshot(1234);

    expect(snapshot.runtimeMode).toBe("mock");
    expect(snapshot.session.isFallback).toBe(true);
    expect(snapshot.integrations.length).toBeGreaterThan(0);
    expect(snapshot.policies.length).toBe(delegatedActionPolicies.length);
    expect(snapshot.pendingActions.length).toBeGreaterThan(0);
  });
});
