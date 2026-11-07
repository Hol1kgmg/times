import { z } from "zod";

// backendFetch の token をこの型に限り、管理者専用の API を Cookie の確認なしに呼べないようにする
const AdminTokenBrand = Symbol("AdminToken");
export const adminToken = z.string().min(1).brand<typeof AdminTokenBrand>();
export type AdminToken = z.infer<typeof adminToken>;
