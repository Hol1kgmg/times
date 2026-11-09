import { z } from "zod";
import { articleId } from "./schemas";

const ENDPOINT = "https://www.google-analytics.com/mp/collect";

const articleOpen = z.object({
  articleId,
  url: z.url(),
  entryDate: z.iso.date(),
});

// ponytail: UA の正規表現だけ。JS を実行してリンクまで押す bot が増えたら isbot などに替える
const BOT = /bot|crawl|spider|headless/iu;

const deviceCategory = (userAgent: string) => {
  if (/iPad|Tablet/iu.test(userAgent)) {
    return "tablet";
  }
  return /Mobi|Android/iu.test(userAgent) ? "mobile" : "desktop";
};

const deferWork = async (): Promise<(work: Promise<unknown>) => void> => {
  try {
    const workers = await import("cloudflare:workers");
    return workers.waitUntil;
  } catch {
    // vite dev (Node) と Vitest には cloudflare:workers が無く、応答を返した後もプロセスが残るので待たずに流す
    return (work) => {
      void work;
    };
  }
};

const send = async (url: string, body: string) => {
  try {
    await fetch(url, { method: "POST", body });
  } catch (error) {
    // 再送はしない (specs/013 FR-003)
    console.error("article_click の送信に失敗", error);
  }
};

export const handleArticleOpen = async (request: Request): Promise<Response> => {
  const parsed = articleOpen.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return new Response(null, { status: 400 });
  }
  const measurementId = process.env.GA_MEASUREMENT_ID;
  const apiSecret = process.env.GA_API_SECRET;
  const userAgent = request.headers.get("user-agent") ?? "";
  if (
    measurementId === undefined ||
    measurementId === "" ||
    apiSecret === undefined ||
    apiSecret === "" ||
    BOT.test(userAgent)
  ) {
    return new Response(null, { status: 204 });
  }
  const ip = request.headers.get("cf-connecting-ip");
  const payload = {
    client_id: crypto.randomUUID(),
    ...(ip === null ? {} : { ip_override: ip }),
    device: { category: deviceCategory(userAgent) },
    events: [
      {
        name: "article_click",
        params: {
          article_id: parsed.data.articleId,
          // GA4 のパラメータの値は 100 文字まで。記事の識別は article_id が担う
          article_url: parsed.data.url.slice(0, 100),
          digest_date: parsed.data.entryDate,
        },
      },
    ],
  };
  const query = new URLSearchParams({ measurement_id: measurementId, api_secret: apiSecret });
  const defer = await deferWork();
  defer(send(`${ENDPOINT}?${query.toString()}`, JSON.stringify(payload)));
  return new Response(null, { status: 204 });
};
