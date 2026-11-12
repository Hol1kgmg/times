import type { RegisteredRouter } from "@tanstack/react-router";
import type { Viewer } from "#/shared/auth";

type RoutePath = RegisteredRouter["routeTree"]["types"]["fileRouteTypes"]["to"];
const channelPaths = [
  "/timeline",
  "/admin/digests/new",
  "/admin/digests",
] as const satisfies readonly RoutePath[];
export type ChannelPath = (typeof channelPaths)[number];

export interface Channel {
  to: ChannelPath;
  label: string;
  mark: "#" | "+";
  status: "open" | "planned";
  // 既定では遷移後に router が先頭へ戻し、画面が出した最下段の位置を上書きする
  resetScroll?: false;
}

// 未ログインへの公開は specs/016 で行う
const timeline = (status: Channel["status"]): Channel => ({
  to: "/timeline",
  label: "timeline",
  mark: "#",
  status,
  resetScroll: false,
});

export const publicChannels = ({ admin }: Viewer): [Channel] => [
  timeline(admin ? "open" : "planned"),
];

// サイドバーは AdminViewer を受け取る部品からだけ描く (.agents/rules/quality.md)
export const adminChannels: Channel[] = [
  { to: "/admin/digests/new", label: "記事を登録", mark: "+", status: "open" },
  { to: "/admin/digests", label: "記事を編集", mark: "#", status: "open" },
];

// トップ自身とログアウトは含めない。管理者向けは照合済みの viewer.admin があるときだけ (adr/frontend/0013, 0014)
export const channelsFor = (viewer: Viewer): [Channel, ...Channel[]] => [
  ...publicChannels(viewer),
  ...(viewer.admin ? adminChannels : []),
];
