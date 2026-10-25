import type { Digest } from "#/shared/api/schemas";
import { DigestPost } from "#/shared/ui/digest-post";
import { loadLinkPreview } from "../api/load-link-preview";
import { CollapsiblePanel } from "./collapsible-panel";
import styles from "./digest-card.module.css";

// bot の 1 投稿という Slack の構造を借りる。チャンネル名は出さない (adr/frontend/0003)
export const DigestCard = ({ digest }: { digest: Digest | null }) => (
  <CollapsiblePanel>
    <section aria-label="最新の Digest">
      {digest ? (
        <DigestPost digest={digest} loadPreview={loadLinkPreview} />
      ) : (
        <p className={styles.empty}>まだ記事がありません</p>
      )}
    </section>
  </CollapsiblePanel>
);
