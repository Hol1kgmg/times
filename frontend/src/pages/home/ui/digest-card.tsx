import { useState } from "react";
import { Button } from "react-aria-components";
import { reportArticleOpen } from "#/shared/api";
import type { Digest } from "#/shared/api";
import { AiToggle } from "#/shared/ui/ai-toggle";
import { CopyToast, useCopyToast } from "#/shared/ui/copy-toast";
import { DigestPost } from "#/shared/ui/digest-post";
import { clipboardIcon } from "#/shared/ui/icons/clipboard";
import { LineIcon } from "#/shared/ui/icons/line-icon";
import { loadLinkPreview } from "../api/load-link-preview";
import { digestMarkdown } from "../model/digest-markdown";
import { CollapsiblePanel } from "./collapsible-panel";
import styles from "./digest-card.module.css";

const checkIcon = "M5 12l5 5l10 -10";

const CopyButton = ({ digest }: { digest: Digest }) => {
  const { shown, show } = useCopyToast();
  const copy = async () => {
    await navigator.clipboard.writeText(digestMarkdown(digest));
    show();
  };
  return (
    <CopyToast className={styles.copyWrap} shown={shown}>
      <Button
        aria-label="Markdown でコピー"
        className={styles.copy}
        onPress={() => {
          void copy();
        }}
      >
        <LineIcon d={shown ? checkIcon : clipboardIcon} size={20} />
      </Button>
    </CopyToast>
  );
};

const Latest = ({ digest }: { digest: Digest }) => {
  const [aiShown, setAiShown] = useState(false);
  return (
    <DigestPost
      action={
        <>
          <CopyButton digest={digest} />
          <AiToggle isSelected={aiShown} onChange={setAiShown} />
        </>
      }
      ai={{ shown: aiShown }}
      digest={digest}
      loadPreview={loadLinkPreview}
      onOpen={reportArticleOpen(digest.entryDate)}
    />
  );
};

// カテゴリごとの bot の投稿という Slack の構造を借りる。チャンネル名は出さない (adr/frontend/0003)
export const DigestCard = ({ digest }: { digest: Digest | null }) => (
  <CollapsiblePanel>
    <section aria-label="最新の Digest">
      {digest ? <Latest digest={digest} /> : <p className={styles.empty}>まだ記事がありません</p>}
    </section>
  </CollapsiblePanel>
);
