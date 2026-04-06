import { config } from "../config/env";
import { createMockSecureRuntimeSnapshot } from "../secure-actions/catalog";
import {
  ApprovalRequestTransitionResult,
  DelegatedActionPreviewInput,
  PendingDelegatedAction,
  PendingDelegatedActionUpdate,
  SecureActionExecutionResult,
  SecureRuntimeSnapshot,
  StepUpRequirementTransitionResult,
} from "../../types";

type JsonResponse<T> = {
  data: T;
};

function endpoint(path: string): string {
  const baseUrl = config.secureActionBffUrl.replace(/\/$/, "");
  return `${baseUrl}${path}`;
}

async function requestJson<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(endpoint(path), {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Secure runtime request failed (${response.status}): ${body || response.statusText}`,
    );
  }

  const payload = (await response.json()) as JsonResponse<T>;
  return payload.data;
}

function withFallbackWarning(
  snapshot: SecureRuntimeSnapshot,
  warning: string,
): SecureRuntimeSnapshot {
  return {
    ...snapshot,
    warnings: [warning, ...snapshot.warnings],
    updatedAt: Date.now(),
  };
}

export const secureActionAdapter = {
  async getRuntimeSnapshot(): Promise<SecureRuntimeSnapshot> {
    try {
      return await requestJson<SecureRuntimeSnapshot>("/api/secure-runtime/snapshot", {
        method: "GET",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown secure runtime error.";
      console.warn("[secureActionAdapter] Falling back to local mock snapshot:", message);
      return withFallbackWarning(
        createMockSecureRuntimeSnapshot(),
        `Secure runtime unavailable. Falling back to local mock mode: ${message}`,
      );
    }
  },

  async previewDelegatedAction(
    input: DelegatedActionPreviewInput,
  ): Promise<PendingDelegatedAction> {
    const response = await requestJson<PendingDelegatedAction>(
      "/api/secure-runtime/pending-actions/preview",
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
    return response;
  },

  async updatePendingAction(
    id: string,
    updates: PendingDelegatedActionUpdate,
  ): Promise<PendingDelegatedAction> {
    return requestJson<PendingDelegatedAction>(
      `/api/secure-runtime/pending-actions/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify(updates),
      },
    );
  },

  async executePendingAction(
    id: string,
  ): Promise<SecureActionExecutionResult> {
    return requestJson<SecureActionExecutionResult>(
      `/api/secure-runtime/pending-actions/${encodeURIComponent(id)}/execute`,
      {
        method: "POST",
      },
    );
  },

  async approveApprovalRequest(
    id: string,
  ): Promise<ApprovalRequestTransitionResult> {
    return requestJson<ApprovalRequestTransitionResult>(
      `/api/secure-runtime/approvals/${encodeURIComponent(id)}/approve`,
      {
        method: "POST",
      },
    );
  },

  async rejectApprovalRequest(
    id: string,
  ): Promise<ApprovalRequestTransitionResult> {
    return requestJson<ApprovalRequestTransitionResult>(
      `/api/secure-runtime/approvals/${encodeURIComponent(id)}/reject`,
      {
        method: "POST",
      },
    );
  },

  async startStepUpRequirement(
    id: string,
  ): Promise<StepUpRequirementTransitionResult> {
    return requestJson<StepUpRequirementTransitionResult>(
      `/api/secure-runtime/step-up/${encodeURIComponent(id)}/start`,
      {
        method: "POST",
      },
    );
  },

  async completeStepUpRequirement(
    id: string,
  ): Promise<StepUpRequirementTransitionResult> {
    return requestJson<StepUpRequirementTransitionResult>(
      `/api/secure-runtime/step-up/${encodeURIComponent(id)}/complete`,
      {
        method: "POST",
      },
    );
  },

  /**
   * @deprecated Use loginWithRedirect from @auth0/auth0-react instead.
   * This manual redirect is kept only for non-live-mode BFF local testing.
   */
  beginLogin(returnTo: string = "/settings"): void {
    console.warn("[secureActionAdapter] Manual login redirect is deprecated. Use Auth0 React SDK.");
    window.location.assign(
      `${endpoint("/api/secure-runtime/auth/login")}?returnTo=${encodeURIComponent(returnTo)}`,
    );
  },

  /**
   * @deprecated Use logout from @auth0/auth0-react instead.
   */
  beginLogout(returnTo: string = "/settings"): void {
    console.warn("[secureActionAdapter] Manual logout redirect is deprecated. Use Auth0 React SDK.");
    window.location.assign(
      `${endpoint("/api/secure-runtime/auth/logout")}?returnTo=${encodeURIComponent(returnTo)}`,
    );
  },
};
