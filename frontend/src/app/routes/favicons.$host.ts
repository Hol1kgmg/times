import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { cachedResponse } from "#/shared/api/index.server";

const host = z
  .string()
  .max(253)
  // 実在するホスト名には _ や末尾の . もあるので、クエリを壊す文字だけを断る
  .regex(/^[a-z0-9_-]+(?:\.[a-z0-9_-]+)*\.?$/u);

// WebGL は CORS を通らない画像をテクスチャにできず、Google の favicon は Access-Control-Allow-Origin を返さない
export const Route = createFileRoute("/favicons/$host")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const parsed = host.safeParse(params.host);
        if (!parsed.success) {
          return new Response(null, { status: 400 });
        }
        // ponytail: どのホストでも中継する。乱用されたら最新の Digest のホストに限る (specs/017 research R4)
        return await cachedResponse(
          `https://cache.times.invalid/favicons/${parsed.data}`,
          86_400,
          async () => {
            let res: Response;
            try {
              // Google が応答を止めると、待っている立方体の山がいつまでも積もり始めないため
              res = await fetch(`https://www.google.com/s2/favicons?domain=${parsed.data}&sz=64`, {
                signal: AbortSignal.timeout(5000),
              });
            } catch {
              return new Response(null, { status: 502 });
            }
            // Google は favicon 無しを既定画像付きの 404 で返すので、これもキャッシュして毎回取りに行かない
            if (!res.ok && res.status !== 404) {
              return new Response(null, { status: 502 });
            }
            // Node の fetch は展開後も content-encoding を残すので、Google のヘッダーは引き継がない
            return new Response(res.body, {
              headers: { "content-type": res.headers.get("content-type") ?? "image/png" },
            });
          },
        );
      },
    },
  },
});
