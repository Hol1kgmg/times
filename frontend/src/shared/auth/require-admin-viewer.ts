import { notFound } from "@tanstack/react-router";
import type { Viewer } from "./get-current-admin";

// 照合は root の beforeLoad で済んでいる。子でもう一度照合すると遷移ごとに backend を直列に 2 回呼ぶ
export const requireAdminViewer = (viewer: Viewer): void => {
  if (viewer.admin === undefined) {
    throw notFound();
  }
};
