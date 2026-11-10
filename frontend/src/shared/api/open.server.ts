import { z } from "zod";
import { articleId } from "./schemas";

const ENDPOINT = "https://www.google-analytics.com/mp/collect";

// どちらのイベントも上限まで埋めて 2 KB ほどに収まる (specs/014 research R3)
const MAX_BODY = 4096;

const openEvent = z.discriminatedUnion("event", [
  z.object({
    event: z.literal("article_click"),
    clientId: z.uuid(),
    articleId,
    url: z.url(),
    entryDate: z.iso.date(),
  }),
  z.object({
    event: z.literal("page_view"),
    clientId: z.uuid(),
    location: z.url(),
    title: z.string(),
  }),
]);

// ponytail: UA の正規表現だけ。JS を実行してリンクまで押す bot が増えたら isbot などに替える
const BOT = /bot|crawl|spider|headless/iu;

const deviceCategory = (userAgent: string) => {
  if (/iPad|Tablet/iu.test(userAgent)) {
    return "tablet";
  }
  return /Mobi|Android/iu.test(userAgent) ? "mobile" : "desktop";
};

const withoutQuery = (location: string) => {
  const url = new URL(location);
  url.search = "";
  url.hash = "";
  return url.toString();
};

// GA4 のパラメータの値は page_location 1000・page_title 300・ほか 100 文字まで
const toGa4Event = (data: z.infer<typeof openEvent>) =>
  data.event === "article_click"
    ? {
        name: "article_click",
        params: {
          article_id: data.articleId,
          article_url: data.url.slice(0, 100),
          digest_date: data.entryDate,
          // 無いとアクティブユーザー数に数えられない (specs/014 research R4)
          engagement_time_msec: 1,
        },
      }
    : {
        name: "page_view",
        params: {
          // 受付が信頼境界なので、ブラウザで落としていてもここで落とす
          page_location: withoutQuery(data.location).slice(0, 1000),
          page_title: data.title.slice(0, 300),
          engagement_time_msec: 1,
        },
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
    console.error("計測イベントの送信に失敗", error);
  }
};

const parseBody = async (request: Request) => {
  // 読む前に断らないと、上限を超える本文もメモリに載ってしまう
  if (Number(request.headers.get("content-length")) > MAX_BODY) {
    return null;
  }
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > MAX_BODY) {
    return null;
  }
  try {
    const parsed = openEvent.safeParse(JSON.parse(new TextDecoder().decode(bytes)));
    if (!parsed.success) {
      return null;
    }
    const { data } = parsed;
    // 他のホストの page_location を受けると GA4 のページのレポートが汚れる
    if (
      data.event === "page_view" &&
      new URL(data.location).origin !== new URL(request.url).origin
    ) {
      return null;
    }
    return data;
  } catch {
    // JSON.parse の SyntaxError だけが来る。形の合わない本文と同じく断る
    return null;
  }
};

export const handleOpen = async (request: Request): Promise<Response> => {
  const data = await parseBody(request);
  if (data === null) {
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
    client_id: data.clientId,
    ...(ip === null ? {} : { ip_override: ip }),
    device: { category: deviceCategory(userAgent) },
    events: [toGa4Event(data)],
  };
  const query = new URLSearchParams({ measurement_id: measurementId, api_secret: apiSecret });
  const defer = await deferWork();
  defer(send(`${ENDPOINT}?${query.toString()}`, JSON.stringify(payload)));
  return new Response(null, { status: 204 });
};
