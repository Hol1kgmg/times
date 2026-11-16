import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { AskAi } from "../ask-ai";
import { AskAiCombined } from "./ask-ai-combined";
import { AskAiUiSdk } from "./ask-ai-ui-sdk";

// issue #167 の検証用。本番の画面からは使わない
const meta = { title: "research/RAC and UI SDK" } satisfies Meta;
export default meta;

type Story = StoryObj<typeof meta>;

const title = "パスキーの仕組みをちゃんと理解する";
const url = "https://example.com/passkey";

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-2)" }}>
    <span className="t-meta" style={{ width: "12em" }}>
      {label}
    </span>
    <a href={url}>{title}</a>
    {children}
    <button type="button">次の要素</button>
  </div>
);

const Rows = () => (
  <div style={{ display: "grid", gap: "calc(var(--space-4) * 3)", padding: "var(--space-4)" }}>
    <Row label="RAC (既存の AskAi)">
      <AskAi title={title} url={url} />
    </Row>
    <Row label="UI SDK だけ">
      <AskAiUiSdk title={title} url={url} />
    </Row>
    <Row label="併用 (トリガーは素の button)">
      <AskAiCombined racTrigger={false} title={title} url={url} />
    </Row>
    <Row label="併用 (トリガーに RAC Button)">
      <AskAiCombined racTrigger title={title} url={url} />
    </Row>
  </div>
);

// サーバーで描いた HTML を実際のブラウザで hydrate し、不一致を data-hydration-errors に残す
const hydrate = (el: HTMLDivElement) => {
  el.innerHTML = renderToString(<Rows />);
  const errors: string[] = [];
  el.dataset.hydrationErrors = "[]";
  const root = hydrateRoot(el, <Rows />, {
    onRecoverableError: (error) => {
      errors.push(String(error));
      el.dataset.hydrationErrors = JSON.stringify(errors);
    },
  });
  return () => {
    root.unmount();
  };
};

const Hydrated = () => <div ref={hydrate} />;

export const Hydration: Story = { render: () => <Hydrated /> };

export const Compare: Story = {
  render: () => <Rows />,
};
