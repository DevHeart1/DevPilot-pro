import { z } from "zod";

/**
 * Enterprise-grade environment variable validation schema.
 * Replaces loose access to process.env and import.meta.env.
 */
const configSchema = z.object({
    // Infrastructure
    VITE_LIVE_MODE: z.string().transform((val) => val === "true").default("false"),
    VITE_LIVE_REPOSITORY_MODE: z.string().transform((val) => val === "true").default("false"),

    // API Keys
    VITE_GEMINI_API_KEY: z.string().optional(),

    // GitLab Configuration
    VITE_GITLAB_URL: z.string().url().default("https://gitlab.com"),
    VITE_GITLAB_TOKEN: z.string().optional(),

    // App Specific (Initial Defaults)
    VITE_TARGET_APP_BASE_URL: z.string().url().optional(),
    VITE_GITLAB_DEFAULT_BRANCH: z.string().default("main"),
    VITE_SANDBOX_URL: z.string().url().optional(),
});

export type Config = z.infer<typeof configSchema>;

/**
 * Validates and returns the application configuration.
 * Surfaces descriptive errors if any critical variables are missing or malformed.
 */
export const validateConfig = (): Config => {
    const env = {
        VITE_LIVE_MODE: import.meta.env.VITE_LIVE_MODE,
        VITE_LIVE_REPOSITORY_MODE: import.meta.env.VITE_LIVE_REPOSITORY_MODE,
        VITE_GEMINI_API_KEY: import.meta.env.VITE_GEMINI_API_KEY,
        VITE_GITLAB_URL: import.meta.env.VITE_GITLAB_URL,
        VITE_GITLAB_TOKEN: import.meta.env.VITE_GITLAB_TOKEN,
        VITE_TARGET_APP_BASE_URL: import.meta.env.VITE_TARGET_APP_BASE_URL,
        VITE_GITLAB_DEFAULT_BRANCH: import.meta.env.VITE_GITLAB_DEFAULT_BRANCH,
        VITE_SANDBOX_URL: import.meta.env.VITE_SANDBOX_URL,
    };

    const result = configSchema.safeParse(env);

    if (!result.success) {
        console.error("❌ Invalid environment variables:", result.error.format());
        // In production, we might want to throw or render a fallback UI.
        // For now, we return valid defaults where possible to avoid crashing during startup.
        return configSchema.parse({});
    }

    return result.data;
};

export const config = validateConfig();
