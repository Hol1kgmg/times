import { describe, expect, it } from "vitest";
import { readAuthConfig } from "./config.server";

const valid = {
  ADMIN_LOGIN_PATH: "e2e-secret-login-path",
  GITHUB_CLIENT_ID: "test",
};

describe(readAuthConfig, () => {
  it("returns undefined when required vars are missing", () => {
    expect(readAuthConfig({})).toBeUndefined();
    expect(readAuthConfig({ ...valid, GITHUB_CLIENT_ID: "" })).toBeUndefined();
  });

  it("rejects a login path shorter than 16 chars or with other chars", () => {
    expect(readAuthConfig({ ...valid, ADMIN_LOGIN_PATH: "abcdefghijklmno" })).toBeUndefined();
    expect(readAuthConfig({ ...valid, ADMIN_LOGIN_PATH: "abc/defghijklmnop" })).toBeUndefined();
  });

  it("returns the config with the GitHub base URL defaulted", () => {
    expect(readAuthConfig(valid)).toStrictEqual({
      loginPath: "e2e-secret-login-path",
      clientId: "test",
      baseUrl: "https://github.com",
    });
    expect(readAuthConfig({ ...valid, GITHUB_BASE_URL: "" })?.baseUrl).toBe("https://github.com");
    expect(readAuthConfig({ ...valid, GITHUB_BASE_URL: "http://localhost:3100" })?.baseUrl).toBe(
      "http://localhost:3100",
    );
  });
});
