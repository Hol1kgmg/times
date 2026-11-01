import { useSortable } from "@dnd-kit/react/sortable";
import { Suspense, useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useHovered } from "#/shared/lib/use-hovered";
import { Favicon } from "#/shared/ui/favicon";
import { HoverButton } from "#/shared/ui/hover-button";
import { Flame } from "#/shared/ui/icons/flame";
import { afterFadeOut } from "#/shared/ui/modal";
import { PreviewCard } from "#/shared/ui/preview-card";
import { loadDraftPreview } from "../api/load-draft-preview";
import type { BoxId, Draft, Link, Rejected } from "../model/board";
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

const Menu = ({ items }: { items: MenuItem[] }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const id = useId();
  return (
    <>
      <HoverButton aria-label="メニュー" className={styles.more} popoverTarget={id} type="button">
        ···
      </HoverButton>
      <div ref={menuRef} className={styles.menu} id={id} popover="auto">
        {items.map((item) => (
          <HoverButton
            key={item.label}
            className={styles.item}
            disabled={item.disabled}
            type="button"
            onClick={() => {
              menuRef.current?.hidePopover();
              item.onSelect();
            }}
          >
            {item.label}
          </HoverButton>
        ))}
      </div>
    </>
  );
};

const EditDialog = ({
  link,
  onEdit,
  onClose,
}: {
  link: Link;
  onEdit: (next: { url: string; title: string }) => Rejected | null;
  onClose: () => void;
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const [title, setTitle] = useState(link.title);
  const [url, setUrl] = useState(link.url);
  const [duplicate, setDuplicate] = useState(false);
  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={headingId}
      className={styles.dialog}
      onClose={afterFadeOut(onClose)}
    >
      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          if (onEdit({ title: title.trim(), url }) === null) {
            dialogRef.current?.close();
          } else {
            setDuplicate(true);
          }
        }}
      >
        <h2 className={styles.heading} id={headingId}>
          記事を編集
        </h2>
        <label className={styles.field}>
          <span className={styles.label}>タイトル</span>
          <input
            className={styles.input}
            maxLength={300}
            required
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
            }}
          />
        </label>
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
          <button
            className={styles.button}
            type="button"
            onClick={() => {
              dialogRef.current?.close();
            }}
          >
            やめる
          </button>
          <button className={styles.submit} type="submit">
            確定
          </button>
        </div>
      </form>
    </dialog>
  );
};

const LinkRow = ({
  link,
  hot = false,
  registered,
  handle,
  menu,
  onEdit,
}: {
  link: Link;
  hot?: boolean;
  registered: boolean;
  handle?: ReactNode;
  menu: MenuItem[];
  onEdit: (next: { url: string; title: string }) => Rejected | null;
}) => {
  const [editing, setEditing] = useState(false);
  const [previewed, setPreviewed] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const show = () => {
    setPreviewed(true);
    setDismissed(false);
  };
  const hovered = useHovered({ onHoverStart: show });
  // カードは下の行を覆うので、ポインターやフォーカスを動かさずに消せるようにする (WCAG 1.4.13)
  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        setDismissed(true);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);
  const host = new URL(link.url).hostname;
  const untitled = link.status !== "loading" && link.title.trim() === "";
  return (
    <div className={styles.row} data-registered={registered ? "" : undefined}>
      {handle}
      <Favicon alt="" className={styles.favicon} url={link.url} />
      <span className={styles.text}>
        <a
          className={styles.title}
          data-dismissed={dismissed ? "" : undefined}
          href={link.url}
          rel="noopener noreferrer"
          target="_blank"
          onFocus={show}
          {...hovered}
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
        </a>
        {previewed && (
          <Suspense fallback={null}>
            <PreviewCard
              className={styles.preview}
              preview={loadDraftPreview(link.url)}
              title={link.title === "" ? host : link.title}
              url={link.url}
            />
          </Suspense>
        )}
        <span className={styles.meta}>
          <span className={styles.host}>{host}</span>
          {link.status === "loading" && (
            <span className={styles.loading}>タイトルを取得してます</span>
          )}
          {untitled && <span className={styles.warn}>タイトルを入れてください</span>}
          {registered && <span className={styles.error}>既に登録済みです</span>}
        </span>
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
