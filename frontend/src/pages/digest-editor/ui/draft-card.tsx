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
  Text,
} from "react-aria-components";
import { loadAnyLinkPreview, translateTitle } from "#/shared/api";
import type { Category } from "#/shared/api";
import { Favicon } from "#/shared/ui/favicon";
import { Flame } from "#/shared/ui/icons/flame";
import { Translate } from "#/shared/ui/icons/translate";
import { ModalDialog } from "#/shared/ui/modal";
import { useLinkPreview } from "#/shared/ui/use-link-preview";
import { canUnlink, isCategory, isGhost, listedHome } from "../model/board";
import type { BoxId, Draft, Link, LinkEdit, Rejected } from "../model/board";
import { LinkMeta } from "./link-meta";
import styles from "./draft-card.module.css";

export interface CardActions {
  atLimit: boolean;
  registered: ReadonlySet<string>;
  converted: ReadonlySet<string>;
  unavailable: ReadonlySet<string>;
  edit: (id: string, next: LinkEdit) => Rejected | null;
  revert: (id: string) => void;
  toggleHot: (id: string) => void;
  remove: (id: string, childCount: number) => void;
  canMakeChild: (id: string) => boolean;
  makeChild: (id: string) => void;
  unmakeChild: (parentId: string, childId: string) => void;
  moveChild: (parentId: string, childId: string, step: -1 | 1) => void;
  unhide: (id: string) => void;
  canLink: (id: string) => boolean;
  startLink: (id: string) => void;
  unlink: (id: string) => void;
  setListed: (id: string, listed: boolean) => void;
}

// 記事のカテゴリは元の掲載の保存でだけ枠のカテゴリに変わり、再掲載では変わらない
const categoryNote = (link: Link, box: BoxId, repost: boolean): string | null => {
  if (link.category === undefined || link.category === box || !isCategory(box)) {
    return null;
  }
  return repost
    ? `記事のカテゴリは${link.category}のままです`
    : `保存するとカテゴリが${box}に変わります`;
};

const listedNote = (draft: Draft, home: Category | null): string | null => {
  if (draft.unpublished === true) {
    return "初回掲載の Digest が公開されてないので載せられません";
  }
  return home === null ? null : `子がないので、元のカテゴリ (${home}) へ移ります`;
};

interface MenuItem {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  // 押した先で何が起きるかを押す前に伝える
  description?: string | null;
}

const Menu = ({ items }: { items: MenuItem[] }) => (
  <MenuTrigger>
    <Button aria-label="メニュー" className={styles.more} data-card-menu="">
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
            textValue={item.label}
            onAction={() => {
              item.onSelect();
            }}
          >
            <Text slot="label">{item.label}</Text>
            {typeof item.description === "string" && (
              <Text className={styles.itemDescription} slot="description">
                {item.description}
              </Text>
            )}
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
  onEdit: (next: LinkEdit) => Rejected | null;
  onClose: () => void;
}) => {
  const headingId = useId();
  const titleId = useId();
  // 欄の文字と「この欄に翻訳を入れたか」は、待つ間に手で直されたかを 1 回の更新で見比べるため組で持つ
  const [field, setField] = useState({ title: link.title, translated: false });
  const { title } = field;
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
      setField((current) =>
        current.title === requested ? { title: result, translated: true } : current,
      );
    }
  };
  return (
    <ModalDialog
      className={styles.dialog}
      closeOnOutside={false}
      labelledBy={headingId}
      onClose={onClose}
    >
      {({ close }) => (
        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            if (onEdit({ title: title.trim(), url, translated: field.translated }) === null) {
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
                  setField((current) => ({ ...current, title: e.target.value }));
                  setTranslation((s) => (s === "failed" ? "idle" : s));
                }}
              />
              <Button
                aria-label="タイトルを翻訳"
                className={styles.translate}
                // ローカルの vite dev には clef が無く、翻訳できない (spec FR-012)
                isDisabled={
                  import.meta.env.DEV ||
                  link.translated ||
                  field.translated ||
                  translation === "translating" ||
                  title.trim() === ""
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

// 公開ページの細い「再掲載」の行と同じく、印・タイトル・注記を 1 行に収める
const SlimText = ({ ghost, children }: { ghost: boolean; children: ReactNode }) => (
  <span className={styles.slimText} data-ghost={ghost ? "" : undefined}>
    <span className={styles.repostMark}>再掲載</span>
    {children}
    {ghost && <span className={styles.slimNote}>子がないので保存されません</span>}
  </span>
);

const LinkRow = ({
  link,
  hot = false,
  suggested = false,
  registered,
  repost = false,
  firstPublishedOn,
  converted = false,
  unavailable = false,
  hidden = false,
  slim,
  note,
  handle,
  action,
  menu,
  onEdit,
}: {
  link: Link;
  hot?: boolean;
  suggested?: boolean;
  registered: boolean;
  repost?: boolean;
  firstPublishedOn?: string;
  converted?: boolean;
  unavailable?: boolean;
  hidden?: boolean;
  slim?: { ghost: boolean };
  note?: string | null;
  handle?: ReactNode;
  action?: ReactNode;
  menu: MenuItem[];
  // 再掲載は元の記事を書き換えないので、渡さず「編集」を出さない
  onEdit?: (next: LinkEdit) => Rejected | null;
}) => {
  const [editing, setEditing] = useState(false);
  const host = new URL(link.url).hostname;
  const { show, dismissed, card } = useLinkPreview({
    url: link.url,
    title: link.title === "" ? host : link.title,
    className: styles.preview,
    load: loadAnyLinkPreview,
  });
  const untitled = link.title.trim() === "";
  const meta = {
    categoryNote: note,
    converted,
    hidden,
    registered,
    suggested,
    unavailable,
    unpublished: link.unpublished === true,
    untitled,
  };
  const anchor = (
    <AriaLink
      className={slim === undefined ? styles.title : styles.slimTitle}
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
  );
  return (
    <div
      className={styles.row}
      data-private={hidden || link.unpublished === true ? "" : undefined}
      data-rejected={registered || unavailable ? "" : undefined}
    >
      {handle}
      <Favicon alt="" className={styles.favicon} url={link.url} />
      {slim === undefined ? (
        <span className={styles.text}>
          {anchor}
          {card}
          <LinkMeta {...meta} firstPublishedOn={firstPublishedOn} host={host} repost={repost} />
        </span>
      ) : (
        <SlimText ghost={slim.ghost}>
          {anchor}
          {card}
          {/* 「再掲載」の印は行頭に出しているので、ここでは重ねない */}
          <LinkMeta {...meta} repost={false} />
        </SlimText>
      )}
      {action}
      <Menu
        items={[
          ...(onEdit === undefined
            ? []
            : [
                {
                  label: "編集",
                  onSelect: () => {
                    setEditing(true);
                  },
                },
              ]),
          ...menu,
        ]}
      />
      {editing && onEdit !== undefined && (
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
  const reasonId = useId();
  const [showVisibilityReason, setShowVisibilityReason] = useState(false);
  const { ref, handleRef, isDragging } = useSortable({
    id: draft.id,
    index,
    group: box,
    // 読み上げ (announcements.ts) で id の代わりに読む
    data: { title: draft.title === "" ? new URL(draft.url).hostname : draft.title, box },
  });
  const last = draft.children.length - 1;
  const remove = {
    label: "削除",
    onSelect: () => {
      actions.remove(draft.id, draft.children.length);
    },
  };
  const menuOf = (): MenuItem[] => {
    if (draft.repost === undefined) {
      return [
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
          label: "掲載済みの記事に紐付ける",
          disabled: !actions.canLink(draft.id),
          onSelect: () => {
            actions.startLink(draft.id);
          },
        },
        {
          label: "変更を戻す",
          onSelect: () => {
            actions.revert(draft.id);
          },
        },
        remove,
      ];
    }
    if (draft.repost.listed) {
      return [
        // 子のない親は掲載をやめると保存されなくなるので、やめる代わりに削除させる
        ...(draft.children.length === 0
          ? []
          : [
              {
                label: "親の掲載をやめる",
                onSelect: () => {
                  actions.setListed(draft.id, false);
                },
              },
            ]),
        remove,
      ];
    }
    const home = listedHome(draft, box);
    // 子は消えないので、確認せずに外す
    return [
      {
        label: "紐付けを外す",
        disabled: !canUnlink(draft),
        onSelect: () => {
          actions.unlink(draft.id);
        },
      },
      {
        label: "親も掲載する",
        // 前の公開の掲載がない記事は、その日に載せると backend が断る (specs/018 FR-005)
        disabled: draft.unpublished === true,
        description: listedNote(draft, home),
        onSelect: () => {
          actions.setListed(draft.id, true);
        },
      },
    ];
  };
  return (
    <li
      ref={ref}
      className={styles.card}
      data-draft-id={draft.id}
      data-dragging={isDragging ? "" : undefined}
    >
      <LinkRow
        action={
          (draft.hidden === true || draft.unpublished === true) && (
            <span className={styles.visibilityAction}>
              <Button
                className={styles.button}
                isDisabled={draft.repost !== undefined || draft.unpublished === true}
                onPress={() => {
                  actions.unhide(draft.id);
                }}
              >
                表示に戻す
              </Button>
              {draft.repost !== undefined && (
                <>
                  <Button
                    aria-describedby={reasonId}
                    aria-label="表示に戻せない理由"
                    className={styles.visibilityHelp}
                    onBlur={() => {
                      setShowVisibilityReason(false);
                    }}
                    onPress={() => {
                      setShowVisibilityReason((shown) => !shown);
                    }}
                  >
                    ?
                  </Button>
                  <span
                    className={styles.visibilityReason}
                    data-open={showVisibilityReason ? "" : undefined}
                    id={reasonId}
                    role="tooltip"
                  >
                    再掲載なので表示を切り替えられません
                  </span>
                </>
              )}
            </span>
          )
        }
        converted={actions.converted.has(draft.url)}
        firstPublishedOn={draft.repost?.firstPublishedOn}
        handle={
          <button ref={handleRef} aria-label="並べ替え" className={styles.handle} type="button">
            <Grip />
          </button>
        }
        hidden={draft.hidden === true}
        hot={draft.hot}
        link={draft}
        menu={menuOf()}
        note={categoryNote(draft, box, draft.repost !== undefined)}
        registered={actions.registered.has(draft.url)}
        repost={draft.repost !== undefined}
        slim={draft.repost?.listed === false ? { ghost: isGhost(draft) } : undefined}
        suggested={draft.suggested}
        unavailable={actions.unavailable.has(draft.url)}
        onEdit={draft.repost === undefined ? (next) => actions.edit(draft.id, next) : undefined}
      />
      {draft.children.length > 0 && (
        <ul className={styles.children}>
          {draft.children.map((child, i) => (
            <li key={child.id}>
              <LinkRow
                hidden={child.hidden === true}
                hot={!draft.hot && child.hot}
                link={child}
                menu={[
                  // 親が HOT なら子もまとめて HOT なので、子だけを切り替えさせない (specs/018 FR-016)
                  ...(draft.hot
                    ? []
                    : [
                        {
                          label: child.hot ? "ホットを外す" : "ホットにする",
                          onSelect: () => {
                            actions.toggleHot(child.id);
                          },
                        },
                      ]),
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
                  // 再掲載の子は記事の親を書き換えないので、親から外せない
                  ...(child.repostChild === true
                    ? []
                    : [
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
                      ]),
                  {
                    label: "削除",
                    onSelect: () => {
                      actions.remove(child.id, 0);
                    },
                  },
                ]}
                note={categoryNote(child, box, child.repostChild === true)}
                registered={actions.registered.has(child.url)}
                repost={child.repostChild === true}
                onEdit={
                  child.repostChild === true ? undefined : (next) => actions.edit(child.id, next)
                }
              />
            </li>
          ))}
        </ul>
      )}
    </li>
  );
};
