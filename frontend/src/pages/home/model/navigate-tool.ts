import { useNavigate, useRouteContext } from "@tanstack/react-router";
import { useEffect } from "react";
import { z } from "zod";
import type { Channel, ChannelPath } from "#/shared/config/channels";
import { channelsFor } from "#/shared/config/channels";
import { defineTool, registerTool } from "#/shared/lib/webmcp";

const descriptions: Record<ChannelPath, string> = {
  "/timeline": "過去の Digest を古い順に読む",
  "/admin/digests/new": "新しい Digest を登録する",
  "/admin/digests": "登録済みの Digest を日付から選んで編集する",
};

const line = (channel: Channel) => `- ${channel.to}: ${descriptions[channel.to]}`;

// adr/frontend/0014
export const useNavigateTool = () => {
  const { viewer } = useRouteContext({ from: "__root__" });
  const navigate = useNavigate();
  useEffect(() => {
    const channels = channelsFor(viewer);
    const [first, ...rest] = channels;
    const controller = new AbortController();
    if (first !== undefined) {
      void registerTool(
        defineTool({
          name: "navigate",
          description: ["z_times.dev の中のページへ移る。行き先:", ...channels.map(line)].join(
            "\n",
          ),
          input: z.object({ to: z.enum([first.to, ...rest.map((c) => c.to)]) }),
          execute: async ({ to }) => {
            const channel = channels.find((c) => c.to === to);
            await navigate({ to, resetScroll: channel?.resetScroll });
            return `${to} に移りました`;
          },
        }),
        controller.signal,
      );
    }
    return () => {
      controller.abort();
    };
  }, [viewer, navigate]);
};
