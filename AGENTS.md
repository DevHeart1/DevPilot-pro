# DevPilot System - Global Agent Instructions

Welcome to the DevPilot project repository. This document outlines the constraints and guidelines for GitLab Duo Custom Agents operating within this codebase.

## System Architecture

DevPilot is an MVP micro-SaaS orchestrating automated codebase tasks. It consists of:
1. **Frontend UI**: React + TypeScript + Vite. Represents the DevPilot Dashboard and Workspace.
2. **Local Persistence**: IndexedDB via Dexie.js (see `src/lib/db`).
3. **Sandbox Execution**: A mock environment simulating a Cloud Run / remote container for running isolated checks (see `devpilot-sandbox`).
4. **GitLab Duo Orchestration Layer**: A custom local flow simulating GitLab Duo Custom Flows and Agents.
   - Uses `DuoFlowRun` to model overarching progress across multiple phases.
   - Triggers formal roles: `ui_inspector`, `code_fixer`, `verifier`, and `system`.

## Global Coding Standards
- **Strict TypeScript**: Do not use `any` unless absolutely necessary. Rely on interfaces defined in `src/types/gitlab-duo.ts` and `src/types/index.ts`.
- **Minimal Dependencies**: Do not introduce new third-party libraries without explicit reason.
- **Incremental Refactoring**: Prioritize stability. Do not perform sweeping architectural changes or UI redesigns unless explicitly instructed.

## GitLab Duo Custom Flow Mapping
When implementing or modifying agent workflows, ensure interactions route through `gitlabDuoAdapter` for agent assignment/handoffs and `gitlabRepositoryAdapter` for repository state changes (branching, MRs).

**Live Execution Mode:**
The platform supports a `liveDuoExecution` toggle in `env.ts`.
When disabled (mock mode), `gitlabDuoAdapter` simulates API responses and fast-forwards flow states.
When enabled, it acts as the primary boundary to communicate with the real GitLab API. Never bypass this adapter.

**Current Custom Flow Definition:**
See `src/lib/gitlab-duo/flows/devpilot.flow.ts` for the static configuration of steps and required agent roles.
