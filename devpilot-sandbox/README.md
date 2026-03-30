# 🛡️ DevPilot Sandbox

The specialized execution engine for DevPilot, providing a secure and isolated environment for UI inspection, script execution, and regression testing.

## 📖 Overview
The sandbox is a Node.js-based service designed to run containerized Playwright instances. It provides the "eyes and ears" for the DevPilot orchestration layer, capturing screenshots and logs from target applications.

## 🚀 Getting Started

### Local Setup
1.  **Navigate to directory**
    ```bash
    cd devpilot-sandbox
    ```
2.  **Install dependencies**
    ```bash
    npm install
    ```
3.  **Run the service**
    ```bash
    npm run start
    ```

### Docker Deployment
The sandbox is optimized for containerized environments (Google Cloud Run, AWS Fargate).
```bash
docker build -t devpilot-sandbox .
docker run -p 8080:8080 devpilot-sandbox
```

## 🏗️ Architecture
-   **Playwright**: Core automation engine.
-   **Express**: Lightweight API layer for task coordination.
-   **Xvfb**: Virtual framebuffer for running headless browsers with full rendering capabilities.

## 📡 API Reference
The sandbox exposes several endpoints used by the main platform:
-   `GET /health`: Connectivity and readiness check.
-   `POST /inspect`: Initiates a UI inspection workflow.
-   `POST /verify`: Executes regression tests against a patch proposal.

---
© 2026 DevPilot Automation Platform
