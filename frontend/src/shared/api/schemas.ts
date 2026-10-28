import { z } from "zod";
import type { components } from "./openapi.gen";

// backend レスポンスの実行時検証。生成型 (openapi.gen.ts) と乖離したら typecheck で落ちる。
// id はブランド化し、parse を通った値しか entity の id として扱えないようにする (adr/frontend/0001)

type Schemas = components["schemas"];

export const itemId = z.uuid().brand<"ItemId">();
export const digestId = z.uuid().brand<"DigestId">();
export const articleId = z.uuid().brand<"ArticleId">();

export const item = z.object({
  id: itemId,
  title: z.string(),
  createdAt: z.iso.datetime(),
}) satisfies z.ZodType<Schemas["Item"]>;

export const category = z.enum([
  "セキュリティ",
  "IT系",
  "UI系",
  "AI系",
  "面白そうなツール・サービス",
  "その他",
]) satisfies z.ZodType<Schemas["Category"]>;

// children を持たない型にすることで孫が作れない (親子 2 階層まで)
export const childArticle = z.object({
  id: articleId,
  title: z.string(),
  url: z.url(),
  description: z.string().optional(),
}) satisfies z.ZodType<Schemas["ChildArticle"]>;

export const article = z.object({
  id: articleId,
  category,
  hot: z.boolean(),
  title: z.string(),
  url: z.url(),
  description: z.string().optional(),
  children: childArticle.array(),
}) satisfies z.ZodType<Schemas["Article"]>;

export const digest = z.object({
  id: digestId,
  entryDate: z.iso.date(),
  items: article.array(),
}) satisfies z.ZodType<Schemas["Digest"]>;

// 登録フォームの入力。境界値は openapi.yaml の NewDigest / NewArticle と同じにする
export const newChildArticle = z.object({
  title: z.string().trim().min(1).max(300),
  // href にそのまま出るので javascript: 等を弾く (openapi.yaml の pattern と同じ)
  url: z.url({ protocol: /^https?$/u }).max(2000),
}) satisfies z.ZodType<Schemas["NewChildArticle"]>;

export const newArticle = newChildArticle.extend({
  category,
  // openapi.yaml の default: false で生成型は必須になるので、省略を false に埋めて型を合わせる
  hot: z.boolean().default(false),
  children: newChildArticle.array().max(20),
}) satisfies z.ZodType<Schemas["NewArticle"]>;

export const newDigest = z.object({
  entryDate: z.iso.date(),
  items: newArticle.array().min(1).max(100),
}) satisfies z.ZodType<Schemas["NewDigest"]>;

export const problem = z.object({
  type: z.enum([
    "about:blank",
    "/problems/validation-failed",
    "/problems/not-found",
    "/problems/url-already-registered",
  ]),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  duplicateUrls: z.string().array().optional(),
}) satisfies z.ZodType<Schemas["Problem"]>;

export type ItemId = z.infer<typeof itemId>;
export type DigestId = z.infer<typeof digestId>;
export type ArticleId = z.infer<typeof articleId>;
export type Item = z.infer<typeof item>;
export type Category = z.infer<typeof category>;
export type ChildArticle = z.infer<typeof childArticle>;
export type Article = z.infer<typeof article>;
export type Digest = z.infer<typeof digest>;
export type NewChildArticle = z.infer<typeof newChildArticle>;
export type NewArticle = z.infer<typeof newArticle>;
export type NewDigest = z.infer<typeof newDigest>;
export type Problem = z.infer<typeof problem>;
