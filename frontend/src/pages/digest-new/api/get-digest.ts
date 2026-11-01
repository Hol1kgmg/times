import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { backendFetchRaw, digest } from "#/shared/api";
import { readAdminToken, SESSION_EXPIRED } from "#/shared/auth";

// 保存直後に開き直したとき古い内容で上書きしないよう、トップと違ってキャッシュを通さない
export const getDigest = createServerFn({ method: "GET" })
  .validator(z.iso.date())
  .handler(async ({ data }) => {
    const token = readAdminToken();
    if (token === undefined || token === "") {
      throw notFound({ data: { reason: SESSION_EXPIRED } });
    }
    const res = await backendFetchRaw(`/digests/${data}`, undefined, { token });
    if (res.status === 401) {
      throw notFound({ data: { reason: SESSION_EXPIRED } });
    }
    if (res.status === 404) {
      throw notFound();
    }
    if (!res.ok) {
      throw new Error(`backend ${res.status}: GET /digests/${data}`);
    }
    return digest.parse(await res.json());
  });
