import type { RegisteredRouter } from "@tanstack/react-router";
import type { AdminViewer, Viewer } from "#/shared/auth";

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
  // 既定では遷移後に router が先頭へ戻し、画面が出した最下段の位置を上書きする
  resetScroll?: false;
}

// 未ログインへの公開は specs/016 で行う
const timeline: Channel = { to: "/timeline", label: "timeline", mark: "#", resetScroll: false };

export const publicChannels = ({ admin }: Viewer): Channel[] => (admin ? [timeline] : []);

export const adminChannels = (_admin: AdminViewer): Channel[] => [
  { to: "/admin/digests/new", label: "記事を登録", mark: "+" },
  { to: "/admin/digests", label: "記事を編集", mark: "#" },
];

// トップ自身とログアウトは含めない。管理者向けは照合済みの viewer.admin があるときだけ (adr/frontend/0013, 0014)
export const channelsFor = (viewer: Viewer): Channel[] => [
  ...publicChannels(viewer),
  ...(viewer.admin ? adminChannels(viewer.admin) : []),
];
