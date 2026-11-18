import { z } from "zod";
import type { components } from "./openapi.gen";

// backend レスポンスの実行時検証。生成型 (openapi.gen.ts) と乖離したら typecheck で落ちる。
// id はブランド化し、parse を通った値しか entity の id として扱えないようにする (adr/frontend/0001)

type Schemas = components["schemas"];

const DigestIdBrand = Symbol("DigestId");
const ArticleIdBrand = Symbol("ArticleId");
export const digestId = z.uuid().brand<typeof DigestIdBrand>();
export const articleId = z.uuid().brand<typeof ArticleIdBrand>();

export const category = z.enum([
  "セキュリティ",
  "IT系",
  "UI系",
  "AI系",
  "面白そうなツール・サービス",
  "その他",
]) satisfies z.ZodType<Schemas["Category"]>;

export const digestStatus = z.enum(["draft", "published", "private"]) satisfies z.ZodType<
  Schemas["DigestStatus"]
>;

// children を持たない型にすることで孫が作れない (親子 2 階層まで)
export const childArticle = z.object({
  id: articleId,
  category,
  hot: z.boolean(),
  repost: z.boolean(),
  hidden: z.boolean(),
  originalStatus: digestStatus,
  title: z.string(),
  url: z.url(),
  description: z.string().optional(),
}) satisfies z.ZodType<Schemas["ChildArticle"]>;

const articleBase = z.object({
  id: articleId,
  category,
  hot: z.boolean(),
  repost: z.boolean(),
  hidden: z.boolean(),
  originalStatus: digestStatus,
  originalCategory: category.optional(),
  children: childArticle.array(),
});

export const visibleArticle = articleBase.extend({
  concealed: z.undefined().optional(),
  title: z.string(),
  url: z.url(),
  description: z.string().optional(),
  firstPublishedOn: z.iso.date().optional(),
});

// 公開ページで表示しない記事の場所。中身は backend が返さない
export const concealedArticle = articleBase.extend({ concealed: z.literal(true) });

export const article = z.union([concealedArticle, visibleArticle]) satisfies z.ZodType<
  Schemas["Article"]
>;

export const digest = z.object({
  id: digestId,
  entryDate: z.iso.date(),
  status: digestStatus,
  articles: article.array(),
}) satisfies z.ZodType<Schemas["Digest"]>;

export const digestSummary = z.object({
  id: digestId,
  entryDate: z.iso.date(),
  status: digestStatus,
}) satisfies z.ZodType<Schemas["DigestSummary"]>;

export const digestPage = z.object({
  digests: digest.array(),
}) satisfies z.ZodType<Schemas["DigestPage"]>;

export const digestList = z.object({
  digests: digestSummary.array(),
}) satisfies z.ZodType<Schemas["DigestList"]>;

export const domainCount = z.object({
  host: z.string().min(1),
  count: z.number().int().min(1),
}) satisfies z.ZodType<Schemas["DomainCount"]>;

export const domainList = z.object({
  domains: domainCount.array(),
}) satisfies z.ZodType<Schemas["DomainList"]>;

// 登録フォームの入力。境界値は openapi.yaml の NewDigest / NewArticle と同じにする
// href にそのまま出るので javascript: 等を弾く (openapi.yaml の pattern と同じ)
const articleUrl = z.url({ protocol: /^https?$/u }).max(2000);

export const newChildArticle = z.object({
  // macOS 由来の NFD の濁点は Klee One Fixed に無く、その字だけ端末のフォントになる (issue #83)
  title: z.string().trim().normalize("NFC").min(1).max(300),
  url: articleUrl,
  // openapi.yaml の default: false で生成型は必須になるので、省略を false に埋めて型を合わせる
  hot: z.boolean().default(false),
}) satisfies z.ZodType<Schemas["NewChildArticle"]>;

export const repostChildArticle = z.object({
  repostOf: articleUrl,
  hot: z.boolean().default(false),
}) satisfies z.ZodType<Schemas["RepostChildArticle"]>;

export const childEntry = z.union([newChildArticle, repostChildArticle]) satisfies z.ZodType<
  Schemas["ChildEntry"]
>;

export const newArticle = newChildArticle.extend({
  category,
  hidden: z.boolean().default(false),
  children: childEntry.array().max(20),
}) satisfies z.ZodType<Schemas["NewArticle"]>;

export const repostArticle = z.object({
  repostOf: articleUrl,
  category,
  children: childEntry.array().max(20),
}) satisfies z.ZodType<Schemas["RepostArticle"]>;

export const digestEntry = z.union([newArticle, repostArticle]) satisfies z.ZodType<
  Schemas["DigestEntry"]
>;

export const newDigest = z.object({
  entryDate: z.iso.date(),
  articles: digestEntry.array().min(1).max(100),
  // hot と同じく openapi.yaml の default で生成型が必須になるので、省略を埋める
  status: digestStatus.extract(["draft", "published"]).default("draft"),
}) satisfies z.ZodType<Schemas["NewDigest"]>;

// 更新では draft を受けない。下書きへ戻せないことは backend もスキーマで守る (specs/006 research R2)
export const digestUpdate = newDigest.omit({ status: true }).extend({
  status: digestStatus.extract(["published", "private"]).optional(),
}) satisfies z.ZodType<Schemas["DigestUpdate"]>;

export const problem = z.object({
  type: z.enum([
    "about:blank",
    "/problems/validation-failed",
    "/problems/not-found",
    "/problems/unauthorized",
    "/problems/forbidden",
    "/problems/upstream-failed",
    "/problems/url-already-registered",
    "/problems/digest-already-exists",
    "/problems/future-publish",
    "/problems/repost-unavailable",
    "/problems/parent-has-children",
  ]),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  duplicateUrls: z.string().array().optional(),
  repostable: z
    .object({ url: z.string(), title: z.string(), category, firstPublishedOn: z.iso.date() })
    .array()
    .optional(),
  hideable: z.object({ url: z.string(), title: z.string(), category }).array().optional(),
}) satisfies z.ZodType<Schemas["Problem"]>;

export type DigestId = z.infer<typeof digestId>;
export type ArticleId = z.infer<typeof articleId>;
export type Category = z.infer<typeof category>;
export type ChildArticle = z.infer<typeof childArticle>;
export type Article = z.infer<typeof article>;
export type VisibleArticle = z.infer<typeof visibleArticle>;
export type Digest = z.infer<typeof digest>;
export type DigestSummary = z.infer<typeof digestSummary>;
export type DigestStatus = z.infer<typeof digestStatus>;
export type NewChildArticle = z.infer<typeof newChildArticle>;
export type ChildEntry = z.infer<typeof childEntry>;
export type NewArticle = z.infer<typeof newArticle>;
export type RepostArticle = z.infer<typeof repostArticle>;
export type DigestEntry = z.infer<typeof digestEntry>;
export type NewDigest = z.infer<typeof newDigest>;
export type DigestUpdate = z.infer<typeof digestUpdate>;
// プレビューと公開表示はステータスを見ない
export type DigestContent = Omit<NewDigest, "status">;
export type Problem = z.infer<typeof problem>;
