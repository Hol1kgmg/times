import { z } from "zod";

// backendFetch の token をこの型に限り、管理者専用の API を Cookie の確認なしに呼べないようにする
export const adminToken = z.string().min(1).brand<"AdminToken">();
export type AdminToken = z.infer<typeof adminToken>;
