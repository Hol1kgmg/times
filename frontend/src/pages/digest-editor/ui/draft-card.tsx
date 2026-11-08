import { useSortable } from "@dnd-kit/react/sortable";
import { useServerFn } from "@tanstack/react-start";
import { useId, useState } from "react";
import type { ReactNode } from "react";
import {
  Link as AriaLink,
  Menu as AriaMenu,
  MenuItem as AriaMenuItem,
  Button,
  MenuTrigger,
  Popover,
} from "react-aria-components";
import { loadAnyLinkPreview, translateTitle } from "#/shared/api";
import { Favicon } from "#/shared/ui/favicon";
import { Flame } from "#/shared/ui/icons/flame";
import { Translate } from "#/shared/ui/icons/translate";
import { ModalDialog } from "#/shared/ui/modal";
import { useLinkPreview } from "#/shared/ui/use-link-preview";
import type { BoxId, Draft, Link, Rejected } from "../model/board";
import { LinkMeta } from "./link-meta";
import styles from "./draft-card.module.css";

export interface CardActions {
  atLimit: boolean;
  registered: ReadonlySet<string>;
  edit: (id: string, next: { url: string; title: string }) => Rejected | null;
  revert: (id: string) => void;
  toggleHot: (id: string) => void;
  remove: (id: string, childCount: number) => void;
  canMakeChild: (id: string) => boolean;
  makeChild: (id: string) => void;
  unmakeChild: (parentId: string, childId: string) => void;
  moveChild: (parentId: string, childId: string, step: -1 | 1) => void;
}

interface MenuItem {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
}

const Menu = ({ items }: { items: MenuItem[] }) => (
  <MenuTrigger>
    <Button aria-label="メニュー" className={styles.more}>
      ···
    </Button>
    <Popover className={styles.menu} offset={0} placement="bottom end">
      <AriaMenu
        className={styles.menuList}
        disabledKeys={items.filter((item) => item.disabled === true).map((item) => item.label)}
      >
        {items.map((item) => (
          <AriaMenuItem
            key={item.label}
            className={styles.item}
            id={item.label}
            onAction={() => {
              item.onSelect();
            }}
          >
            {item.label}
          </AriaMenuItem>
        ))}
      </AriaMenu>
    </Popover>
  </MenuTrigger>
);

const EditDialog = ({
  link,
  onEdit,
  onClose,
}: {
  link: Link;
  onEdit: (next: { url: string; title: string }) => Rejected | null;
  onClose: () => void;
}) => {
  const headingId = useId();
  const titleId = useId();
  const [title, setTitle] = useState(link.title);
  const [url, setUrl] = useState(link.url);
  const [duplicate, setDuplicate] = useState(false);
  const [translation, setTranslation] = useState<"idle" | "translating" | "failed">("idle");
  const translate = useServerFn(translateTitle);

  const translated = async (requested: string) => {
    try {
      return await translate({ data: { title: requested } });
    } catch {
      // 例外も確認を通らなかった結果と同じく失敗の表示にし、押し直してもらう (spec US2)
      return null;
    }
  };

  const onTranslate = async () => {
    const requested = title;
    setTranslation("translating");
    const result = await translated(requested);
    setTranslation(result === null ? "failed" : "idle");
    if (result !== null) {
      // 翻訳を待つ間に手で直したタイトルは上書きしない
      setTitle((current) => (current === requested ? result : current));
    }
  };
  return (
    <ModalDialog className={styles.dialog} labelledBy={headingId} onClose={onClose}>
      {({ close }) => (
        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            if (onEdit({ title: title.trim(), url }) === null) {
              close();
            } else {
              setDuplicate(true);
            }
          }}
        >
          <h2 className={styles.heading} id={headingId}>
            記事を編集
          </h2>
          <div className={styles.field}>
            {/* 状態の文言を欄の下に出すと、下の URL 欄とボタンが押す途中で動く */}
            <div className={styles.labelRow}>
              <label className={styles.label} htmlFor={titleId}>
                タイトル
              </label>
              <span aria-live="polite" className={styles.translationNote}>
                {translation === "translating" && "翻訳してます"}
                {translation === "failed" && "翻訳できませんでした"}
              </span>
            </div>
            <div className={styles.inputBox}>
              <input
                className={styles.boxedInput}
                id={titleId}
                maxLength={300}
                required
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setTranslation((s) => (s === "failed" ? "idle" : s));
                }}
              />
              <Button
                aria-label="タイトルを翻訳"
                className={styles.translate}
                // ローカルの vite dev には clef が無く、翻訳できない (spec FR-012)
                isDisabled={
                  import.meta.env.DEV || translation === "translating" || title.trim() === ""
                }
                onPress={() => {
                  void onTranslate();
                }}
              >
                <Translate />
              </Button>
            </div>
          </div>
          <label className={styles.field}>
            <span className={styles.label}>URL</span>
            <input
              className={styles.input}
              maxLength={2000}
              pattern="https?://.+"
              required
              title="http か https で始まる URL"
              type="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
              }}
            />
          </label>
          {duplicate && <p className={styles.note}>その URL はもう入ってます</p>}
          <div className={styles.formActions}>
            <Button
              className={styles.button}
              onPress={() => {
                close();
              }}
            >
              やめる
            </Button>
            <Button className={styles.button} type="submit">
              確定
            </Button>
          </div>
        </form>
      )}
    </ModalDialog>
  );
};

const LinkRow = ({
  link,
  hot = false,
  suggested = false,
  registered,
  handle,
  menu,
  onEdit,
}: {
  link: Link;
  hot?: boolean;
  suggested?: boolean;
  registered: boolean;
  handle?: ReactNode;
  menu: MenuItem[];
  onEdit: (next: { url: string; title: string }) => Rejected | null;
}) => {
  const [editing, setEditing] = useState(false);
  const host = new URL(link.url).hostname;
  const { show, dismissed, card } = useLinkPreview({
    url: link.url,
    title: link.title === "" ? host : link.title,
    className: styles.preview,
    load: loadAnyLinkPreview,
  });
  const untitled = link.status !== "loading" && link.title.trim() === "";
  return (
    <div className={styles.row} data-registered={registered ? "" : undefined}>
      {handle}
      <Favicon alt="" className={styles.favicon} url={link.url} />
      <span className={styles.text}>
        <AriaLink
          className={styles.title}
          data-dismissed={dismissed ? "" : undefined}
          href={link.url}
          rel="noopener noreferrer"
          target="_blank"
          onFocus={show}
          onHoverStart={show}
        >
          <span className={styles.titleText} title={link.title}>
            {link.title === "" ? host : link.title}
          </span>
          {hot && (
            <span className={styles.hot}>
              {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- <img> だと currentColor で塗れない */}
              <Flame aria-label="ホット" role="img" size={14} />
            </span>
          )}
        </AriaLink>
        {card}
        <LinkMeta
          host={host}
          loading={link.status === "loading"}
          registered={registered}
          suggested={suggested}
          untitled={untitled}
        />
      </span>
      <Menu
        items={[
          {
            label: "編集",
            onSelect: () => {
              setEditing(true);
            },
          },
          ...menu,
        ]}
      />
      {editing && (
        <EditDialog
          link={link}
          onClose={() => {
            setEditing(false);
          }}
          onEdit={onEdit}
        />
      )}
    </div>
  );
};

// lucide の grip-vertical (ISC)
const Grip = () => (
  <svg
    aria-hidden="true"
    fill="none"
    height={16}
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={2}
    viewBox="0 0 24 24"
    width={16}
  >
    <circle cx="9" cy="12" r="1" />
    <circle cx="9" cy="5" r="1" />
    <circle cx="9" cy="19" r="1" />
    <circle cx="15" cy="12" r="1" />
    <circle cx="15" cy="5" r="1" />
    <circle cx="15" cy="19" r="1" />
  </svg>
);

// 関連記事は sortable にしない。親と一緒に動き、単独では掴めない (spec FR-020)
export const DraftCard = ({
  draft,
  index,
  box,
  actions,
}: {
  draft: Draft;
  index: number;
  box: BoxId;
  actions: CardActions;
}) => {
  const { ref, handleRef, isDragging } = useSortable({
    id: draft.id,
    index,
    group: box,
    // 読み上げ (announcements.ts) で id の代わりに読む
    data: { title: draft.title === "" ? new URL(draft.url).hostname : draft.title, box },
  });
  const last = draft.children.length - 1;
  return (
    <li ref={ref} className={styles.card} data-dragging={isDragging ? "" : undefined}>
      <LinkRow
        handle={
          <button ref={handleRef} aria-label="並べ替え" className={styles.handle} type="button">
            <Grip />
          </button>
        }
        hot={draft.hot}
        link={draft}
        menu={[
          {
            label: draft.hot ? "ホットを外す" : "ホットにする",
            onSelect: () => {
              actions.toggleHot(draft.id);
            },
          },
          {
            label: "上の記事の関連記事にする",
            disabled: !actions.canMakeChild(draft.id),
            onSelect: () => {
              actions.makeChild(draft.id);
            },
          },
          {
            label: "変更を戻す",
            onSelect: () => {
              actions.revert(draft.id);
            },
          },
          {
            label: "削除",
            onSelect: () => {
              actions.remove(draft.id, draft.children.length);
            },
          },
        ]}
        registered={actions.registered.has(draft.url)}
        suggested={draft.suggested}
        onEdit={(next) => actions.edit(draft.id, next)}
      />
      {draft.children.length > 0 && (
        <ul className={styles.children}>
          {draft.children.map((child, i) => (
            <li key={child.id}>
              <LinkRow
                link={child}
                menu={[
                  {
                    label: "上へ",
                    disabled: i === 0,
                    onSelect: () => {
                      actions.moveChild(draft.id, child.id, -1);
                    },
                  },
                  {
                    label: "下へ",
                    disabled: i === last,
                    onSelect: () => {
                      actions.moveChild(draft.id, child.id, 1);
                    },
                  },
                  {
                    label: "関連記事から外す",
                    disabled: actions.atLimit,
                    onSelect: () => {
                      actions.unmakeChild(draft.id, child.id);
                    },
                  },
                  {
                    label: "変更を戻す",
                    onSelect: () => {
                      actions.revert(child.id);
                    },
                  },
                  {
                    label: "削除",
                    onSelect: () => {
                      actions.remove(child.id, 0);
                    },
                  },
                ]}
                registered={actions.registered.has(child.url)}
                onEdit={(next) => actions.edit(child.id, next)}
              />
            </li>
          ))}
        </ul>
      )}
    </li>
  );
};
