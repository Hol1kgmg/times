import { defineConfig, devices } from "@playwright/test";

const isCI = Boolean(process.env.CI);

// 管理者ログインの e2e は GitHub モック (e2e/github-mock.ts) を向く。
// backend は事前に `just db-up && just be-dev-e2e` で同じモックに向けて起動しておく。
// 既定のポートは 3001。開発用の dev server (3000) を再利用すると e2e 用の環境変数が効かず、
// 秘匿パスが 404 になるため分けている。変えるときは E2E_PORT
const port = Number(process.env.E2E_PORT ?? 3001);
const githubMockPort = 3100;

export default defineConfig({
  testDir: "./e2e",
  reporter: "html",
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  forbidOnly: isCI,
  use: {
    baseURL: `http://localhost:${port}`,
    ...devices["Desktop Chrome"],
  },
  webServer: [
    {
      command: "node e2e/github-mock.ts",
      url: `http://localhost:${githubMockPort}/login/oauth/authorize`,
      env: { PORT: String(githubMockPort) },
      reuseExistingServer: !isCI,
    },
    {
      command: `pnpm dev --port ${port}`,
      url: `http://localhost:${port}`,
      env: {
        ADMIN_LOGIN_PATH: "e2e-secret-login-path",
        GITHUB_CLIENT_ID: "test",
        GITHUB_BASE_URL: `http://localhost:${githubMockPort}`,
      },
      reuseExistingServer: !isCI,
    },
  ],
});
