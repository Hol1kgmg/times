import { useState } from "react";
import type { Digest } from "#/shared/api/schemas";
import { digestMarkdown } from "#/shared/lib/digest-markdown";
import { DigestPost } from "#/shared/ui/digest-post";
import { HoverButton } from "#/shared/ui/hover-button";
import { clipboardIcon } from "#/shared/ui/icons/clipboard";
import { loadLinkPreview } from "../api/load-link-preview";
import { CollapsiblePanel } from "./collapsible-panel";
import styles from "./digest-card.module.css";

const checkIcon = "M5 12l5 5l10 -10";

const CopyButton = ({ digest }: { digest: Digest }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(digestMarkdown(digest));
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };
  return (
    <span className={styles.copyWrap}>
      <HoverButton
        aria-label="Markdown でコピー"
        className={styles.copy}
        type="button"
        onClick={() => {
          void copy();
        }}
      >
        <svg
          fill="none"
          height={20}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          viewBox="0 0 24 24"
          width={20}
        >
          <path d={copied ? checkIcon : clipboardIcon} />
        </svg>
      </HoverButton>
      {/* 中身の差し替えで読み上げさせるため、領域は常に置いて文字だけ出し入れする */}
      <output className={styles.toast}>
        {copied && <span className={styles.toastText}>コピーしました</span>}
      </output>
    </span>
  );
};

// bot の 1 投稿という Slack の構造を借りる。チャンネル名は出さない (adr/frontend/0003)
export const DigestCard = ({ digest }: { digest: Digest | null }) => (
  <CollapsiblePanel>
    <section aria-label="最新の Digest">
      {digest ? (
        <DigestPost
          action={<CopyButton digest={digest} />}
          digest={digest}
          loadPreview={loadLinkPreview}
        />
      ) : (
        <p className={styles.empty}>まだ記事がありません</p>
      )}
    </section>
  </CollapsiblePanel>
);
