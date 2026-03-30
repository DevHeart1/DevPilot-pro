<div align="center">
  <img width="1200" height="475" alt="DevPilot Enterprise Banner" src="file_000000004094720aa3dbb97627a77e26.png" />
  <h1>🚀 DevPilot: Enterprise-Grade AI Automation</h1>
  <p><i>The intelligent orchestration layer for modern development workflows.</i></p>
  
  [![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
  [![Stack: React 19](https://img.shields.io/badge/Stack-React%2019-teal.svg)](https://react.dev/)
  [![Database: Dexie](https://img.shields.io/badge/Database-Dexie.js-orange.svg)](https://dexie.org/)
  [![Language: TypeScript](https://img.shields.io/badge/Language-TypeScript-blue.svg)](https://www.typescriptlang.org/)
</div>

---

## 📖 Overview
**DevPilot** is a powerful automation platform designed to bridge the gap between high-level instructions and complex repository management. Built for enterprise environments, it orchestrates GitLab Duo flows, sandbox execution, and AI-driven code reviews to accelerate delivery without sacrificing quality.

### Key Capabilities
-   **🤖 Intelligent Orchestration**: Seamless integration with GitLab Duo and Gemini Pro for high-fidelity code generation and analysis.
-   **🛡️ Secure Sandboxing**: Isolated Playwright-driven environment for UI inspection and regression testing.
-   **📊 Task Hub**: Real-time lifecycle management for tasks, code reviews, and automated commit proposals.
-   **💾 Edge Persistence**: High-performance local storage powered by Dexie.js for a responsive, offline-first experience.

---

## 🏗️ Architecture

```mermaid
graph TD
    A[DevPilot Dashboard] --> B{Task Hub}
    B --> C[GitLab Adapter]
    B --> D[Gemini Engine]
    B --> E[Sandbox Adapter]
    E --> F[Containerized Playwright]
    C --> G[GitLab Duo Flows]
    F --> H[UI Evidence & Screenshots]
    H --> D
    D --> I[Patch Proposal]
    I --> B
```

---

## 🚀 Getting Started

### Prerequisites
-   **Node.js**: v20 or higher
-   **GitLab Account**: With API access for repository orchestration.
-   **Gemini API Key**: For agent intelligence.

### Installation
1.  **Clone the Repository**
    ```bash
    git clone https://github.com/DevHeart1/DevPilot-.git
    cd DevPilot-
    ```
2.  **Install Dependencies**
    ```bash
    npm install
    ```
3.  **Environment Setup**
    Copy `.env.example` to `.env.local` and configure your keys:
    ```bash
    cp .env.example .env.local
    ```
4.  **Run Development Server**
    ```bash
    npm run dev
    ```

---

## 🛡️ Enterprise Security & Standards
DevPilot adheres to strict enterprise development standards:
-   **Runtime Validation**: All configuration is strictly validated using Zod at startup.
-   **Modular Design**: Decoupled architecture using custom hooks and isolated adapter layers.
-   **Quality Gates**: Enforced styling via Prettier and linting via ESLint Flat Config.
-   **Audit Logs**: Comprehensive changelog logic based on real commit data.

---

## 📦 Sub-Modules
-   **[devpilot-sandbox](./devpilot-sandbox)**: The execution core. Containerized environment for testing and inspection.

---

## 🤝 Contributing
We welcome professional contributions. Please see our [CONTRIBUTING.md](./CONTRIBUTING.md) for standards and workflow details.

---

<div align="center">
  <p>© 2026 DevPilot Automation Platform. All Rights Reserved.</p>
</div>
