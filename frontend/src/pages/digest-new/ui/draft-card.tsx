import { useSortable } from "@dnd-kit/react/sortable";
import { useCallback, useId, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { Favicon } from "#/shared/ui/favicon";
import { Flame } from "#/shared/ui/icons/flame";
import type { BoxId, Draft, Link, Rejected } from "../model/board";
import styles from "./draft-card.module.css";

export interface CardActions {
  atLimit: boolean;
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
      <button aria-label="メニュー" className={styles.more} popoverTarget={id} type="button">
        ···
      </button>
      <div ref={menuRef} className={styles.menu} id={id} popover="auto">
        {items.map((item) => (
          <button
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
          </button>
        ))}
      </div>
    </>
  );
};

const EditForm = ({
  link,
  onEdit,
  onClose,
}: {
  link: Link;
  onEdit: (next: { url: string; title: string }) => Rejected | null;
  onClose: () => void;
}) => {
  const [title, setTitle] = useState(link.title);
  const [url, setUrl] = useState(link.url);
  const [duplicate, setDuplicate] = useState(false);
  const focusOnMount = useCallback((el: HTMLInputElement | null) => {
    el?.focus();
  }, []);
  const closeOnEscape = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      onClose();
    }
  };
  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        if (onEdit({ title: title.trim(), url }) === null) {
          onClose();
        } else {
          setDuplicate(true);
        }
      }}
    >
      <label className={styles.field}>
        <span className={styles.label}>タイトル</span>
        <input
          // メニューの「編集」を選んだ続きで打ち始められるようにする。autoFocus はダイアログの外では使えない (markuplint)
          ref={focusOnMount}
          className={styles.input}
          maxLength={300}
          required
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
          }}
          onKeyDown={closeOnEscape}
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
          onKeyDown={closeOnEscape}
        />
      </label>
      {duplicate && <p className={styles.note}>その URL はもう入ってます</p>}
      <div className={styles.formActions}>
        <button className={styles.button} type="button" onClick={onClose}>
          やめる
        </button>
        <button className={styles.button} type="submit">
          確定
        </button>
      </div>
    </form>
  );
};

const LinkRow = ({
  link,
  hot = false,
  handle,
  menu,
  onEdit,
}: {
  link: Link;
  hot?: boolean;
  handle?: ReactNode;
  menu: MenuItem[];
  onEdit: (next: { url: string; title: string }) => Rejected | null;
}) => {
  const [editing, setEditing] = useState(false);
  const host = new URL(link.url).hostname;
  const untitled = link.status !== "loading" && link.title.trim() === "";
  return (
    <div className={styles.row}>
      {handle}
      <Favicon alt="" className={styles.favicon} url={link.url} />
      {editing ? (
        <EditForm
          link={link}
          onClose={() => {
            setEditing(false);
          }}
          onEdit={onEdit}
        />
      ) : (
        <>
          <span className={styles.text}>
            <a className={styles.title} href={link.url} rel="noopener noreferrer" target="_blank">
              {link.title === "" ? host : link.title}
              {hot && (
                <span className={styles.hot}>
                  {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- <img> だと currentColor で塗れない */}
                  <Flame aria-label="ホット" role="img" size={14} />
                </span>
              )}
            </a>
            <span className={styles.meta}>
              {host}
              {link.status === "loading" && (
                <span className={styles.loading}>タイトルを取得してます</span>
              )}
              {untitled && <span className={styles.warn}>タイトルを入れてください</span>}
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
        </>
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
            label: "取得直後に戻す",
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
                    label: "取得直後に戻す",
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
                onEdit={(next) => actions.edit(child.id, next)}
              />
            </li>
          ))}
        </ul>
      )}
    </li>
  );
};
