import { z } from "zod";

const booleanFlag = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const configSchema = z.object({
  VITE_LIVE_MODE: booleanFlag,
  VITE_LIVE_REPOSITORY_MODE: booleanFlag,
  VITE_LIVE_AUTH_MODE: booleanFlag,
  VITE_LIVE_DELEGATED_ACTION_MODE: booleanFlag,

  VITE_GEMINI_API_KEY: z.string().optional(),

  VITE_GITLAB_URL: z.string().url().default("https://gitlab.com"),
  VITE_GITLAB_TOKEN: z.string().optional(),

  VITE_TARGET_APP_BASE_URL: z.string().url().optional(),
  VITE_SANDBOX_URL: z.string().url().optional(),
  VITE_SECURE_ACTION_BFF_URL: z.string().url().default("http://localhost:3201"),
  VITE_GITLAB_DEFAULT_BRANCH: z.string().default("main"),

  VITE_AUTH0_DOMAIN: z.string().optional(),
  VITE_AUTH0_CLIENT_ID: z.string().optional(),
  VITE_AUTH0_AUDIENCE: z.string().optional(),
  VITE_AUTH0_TOKEN_VAULT_GITHUB_CONNECTION: z.string().optional(),
  VITE_AUTH0_TOKEN_VAULT_GITLAB_CONNECTION: z.string().optional(),
  VITE_AUTH0_TOKEN_VAULT_SLACK_CONNECTION: z.string().optional(),
  VITE_AUTH0_TOKEN_VAULT_GOOGLE_CONNECTION: z.string().optional(),
});

export type Config = z.infer<typeof configSchema>;

export const validateConfig = (): Config => {
  const env = {
    VITE_LIVE_MODE: import.meta.env.VITE_LIVE_MODE,
    VITE_LIVE_REPOSITORY_MODE: import.meta.env.VITE_LIVE_REPOSITORY_MODE,
    VITE_LIVE_AUTH_MODE: import.meta.env.VITE_LIVE_AUTH_MODE,
    VITE_LIVE_DELEGATED_ACTION_MODE:
      import.meta.env.VITE_LIVE_DELEGATED_ACTION_MODE,
    VITE_GEMINI_API_KEY: import.meta.env.VITE_GEMINI_API_KEY,
    VITE_GITLAB_URL: import.meta.env.VITE_GITLAB_URL,
    VITE_GITLAB_TOKEN: import.meta.env.VITE_GITLAB_TOKEN,
    VITE_TARGET_APP_BASE_URL: import.meta.env.VITE_TARGET_APP_BASE_URL,
    VITE_SANDBOX_URL: import.meta.env.VITE_SANDBOX_URL,
    VITE_SECURE_ACTION_BFF_URL: import.meta.env.VITE_SECURE_ACTION_BFF_URL,
    VITE_GITLAB_DEFAULT_BRANCH: import.meta.env.VITE_GITLAB_DEFAULT_BRANCH,
    VITE_AUTH0_DOMAIN: import.meta.env.VITE_AUTH0_DOMAIN,
    VITE_AUTH0_CLIENT_ID: import.meta.env.VITE_AUTH0_CLIENT_ID,
    VITE_AUTH0_AUDIENCE: import.meta.env.VITE_AUTH0_AUDIENCE,
    VITE_AUTH0_TOKEN_VAULT_GITHUB_CONNECTION:
      import.meta.env.VITE_AUTH0_TOKEN_VAULT_GITHUB_CONNECTION,
    VITE_AUTH0_TOKEN_VAULT_GITLAB_CONNECTION:
      import.meta.env.VITE_AUTH0_TOKEN_VAULT_GITLAB_CONNECTION,
    VITE_AUTH0_TOKEN_VAULT_SLACK_CONNECTION:
      import.meta.env.VITE_AUTH0_TOKEN_VAULT_SLACK_CONNECTION,
    VITE_AUTH0_TOKEN_VAULT_GOOGLE_CONNECTION:
      import.meta.env.VITE_AUTH0_TOKEN_VAULT_GOOGLE_CONNECTION,
  };

  const result = configSchema.safeParse(env);

  if (!result.success) {
    console.error("Invalid environment variables:", result.error.format());
    return configSchema.parse({});
  }

  return result.data;
};

export const config = validateConfig();
