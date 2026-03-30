# Cloud Run Deployment Guide (devpilot-sandbox)

I've created the `Dockerfile` and `.dockerignore` files in your `devpilot-sandbox/` directory. Follow these steps to complete the deployment in the Google Cloud Console.

## GCP Console Configuration

In the **Set up Cloud Build** side panel (from your screenshot):

1.  **Source location**: Change `/Dockerfile` to `devpilot-sandbox/Dockerfile`.
2.  **Save**: Click the "Save" button.

### Service Settings

Once the build is configured, ensure the following settings are applied:

*   **Container Port**: `8080` (This matches the internal Express server).
*   **Memory**: At least `2 GiB` (Playwright and the GUI stack require significant memory for rendering).
*   **CPU**: `1` or `2` vCPUs.
*   **Authentication**: Select **"Allow unauthenticated invocations"** if you want to access the sandbox API directly, or keep it restricted if you'll use IAM.

## Environment Variables

The sandbox needs to know where its internal ports are. Usually, the defaults in the Dockerfile work, but you can set these in Cloud Run if needed:

*   `PORT`: `8080`
*   `WS_PORT`: `6080`

## Accessing the Sandbox

After deployment, Cloud Run will provide a URL (e.g., `https://devpilot-sandbox-xyz.a.run.app`).

1.  **Health Check**: Visit `https://<your-url>/api/health` to verify it's running.
2.  **DevPilot Config**: Update your main app's `.env` with `VITE_SANDBOX_URL=https://<your-url>`.
