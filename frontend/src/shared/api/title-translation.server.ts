import { z } from "zod";
import { retry, RetryableError } from "./retry.server";
import { fromHtml, toHtml } from "./title-html";

const ENDPOINT = "https://translation.googleapis.com/language/translate/v2";
const response = z.object({
  data: z.object({ translations: z.tuple([z.object({ translatedText: z.string() })]) }),
});

const translateEnv = z.object({ GOOGLE_TRANSLATE_API_KEY: z.string().min(1) });

export const translateWithTerms = async (
  title: string,
  terms: string[],
): Promise<string | null> => {
  const { GOOGLE_TRANSLATE_API_KEY: key } = translateEnv.parse(process.env);
  const body = await retry(async () => {
    let res: Response;
    try {
      res = await fetch(ENDPOINT, {
        method: "POST",
        // クエリの key= はリクエストの URL ごとログに残るので、ヘッダーで渡す
        headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key },
        body: JSON.stringify({
          q: toHtml(title, terms),
          source: "en",
          target: "ja",
          format: "html",
        }),
      });
    } catch (error) {
      throw new RetryableError("translation request failed", { cause: error });
    }
    if (res.status >= 500) {
      throw new RetryableError(`translation failed: ${res.status}`);
    }
    if (!res.ok) {
      throw new Error(`translation rejected: ${res.status}`);
    }
    return (await res.json()) as unknown;
  });
  return fromHtml(title, terms, response.parse(body).data.translations[0].translatedText);
};
