# Contract: UI の受け渡し

## 拒否の変換 (`rejection-of.ts`)

- `url-already-registered` は `{ reason; duplicateUrls: string[]; repostable: Repostable[] }` にする。`Repostable` は `{ url; title; category; firstPublishedOn }`
- `{ reason: "repost-unavailable"; duplicateUrls: string[] }` を足す
- `repost-needs-child` は消す

## 編集画面の再掲載の切り替え

- `url-already-registered` を受けたら、`repostable` の URL の親の行を再掲載にする: `Draft.repost = { category, firstPublishedOn }` (元の記事のカテゴリと日付)、`title` を元の記事のものにする。子がなければ `category` も元の記事のものにする
- 切り替えた URL の集合を持ち、その行の `LinkMeta` の `converted` を立てる。断られるたびに `registered` / `converted` / `unavailable` をすべて入れ替える
- 自動では保存し直さない
- 送るときは、再掲載の行を `{ repostOf: url, category, children }` にする
- 保存後の redirect は初版の前に戻す (`?reposted` は消す)

## 再掲載の行 (`DraftCard`)

- メニューに「編集」「ホットにする / 外す」「上の記事の関連記事にする」を出さない。出すのは「削除」だけ
- カテゴリの `<select>` は子がない間は `isDisabled` にし、元の記事のカテゴリに固定する。子が 0 件になったらカテゴリを元に戻す
- 子の行のメニューに「ホットにする / 外す」を足す。親が HOT の間は出さない

## LinkMeta (編集画面の記事行のメタ行)

```ts
interface LinkMetaProps {
  host: string;
  untitled: boolean;
  suggested: boolean;
  registered: boolean;
  firstPublishedOn?: string; // 再掲載の行で、前の公開の掲載があるときだけ。「再掲載 · 10月3日(土)に初掲載」を faint で出す
  repost: boolean; // 日付がない (前の掲載が下書き・非公開だけ) ときは「再掲載」だけを faint で出す
  converted: boolean; // 断られて再掲載に切り替えた行。「再掲載にしました」を accent で出す
  unavailable: boolean; // 「この記事は再掲載できません」を danger で出す
}
```

## DigestPost (公開ページ・プレビューの投稿)

- 記事の型は生成型の `Article` (`repost`・子の `hot`) をそのまま使う。下書きの型は `repost` と子の `hot` を持つ
- 「再掲載」の印と細い行は `firstPublishedOn` があるときだけ出す (FR-010)。`repost` が true でも `firstPublishedOn` がなければ普通の行にし、HOT だけ付けない
- 子のある再掲載の親の行は細い形にする (子がなければ普通の大きさで、印だけ付ける): favicon を小さく、「再掲載」の印 (`.t-meta` の faint) をタイトルの前に置き、タイトルは `.t-body` の `--color-text-muted` で、1 行に収めて末尾を「…」で省略する (AI のアイコンは省略の外に残す)。リンク・記事カード・AI のアイコンは普通の行と同じ。HOT は付かない
- HOT の印は、HOT の親の行と、HOT でない親の下の HOT の子の行に付ける (FR-017)

## Storybook のデモ

| ファイル | story | 見せるもの |
|---|---|---|
| `shared/ui/digest-post.stories.tsx` | `Repost` | 再掲載の細い親と新しい子 2 件 (子のうち 1 件は HOT)、子のない再掲載 (普通の大きさ) |
| `shared/ui/digest-post.stories.tsx` | `RepostWithAskAi` | `ai: { shown: true }` で細い行に AI のアイコンが並んでも崩れないこと |
| `shared/ui/digest-post.stories.tsx` | `HotPatterns` | 親子の HOT の ○○ / ×○ / ×× を並べる (○× は作れない) |
| `pages/digest-editor/ui/link-meta.stories.tsx` | `Repost` | 保存済みの再掲載 (印と日付) |
| `pages/digest-editor/ui/link-meta.stories.tsx` | `RepostConverted` | 断られて切り替えた直後 (印 + 「再掲載にしました」) |
| `pages/digest-editor/ui/link-meta.stories.tsx` | `RepostUnavailable` | 再掲載できないと断られた行 |
| `pages/digest-editor/ui/link-meta.stories.tsx` | `RepostUnpublished` | 元の Digest が公開されていない再掲載の行 |
| `pages/digest-editor/ui/link-meta.stories.tsx` | `Hidden` | 子がほかの日にいて外す代わりに隠した行 |
| `pages/digest-editor/ui/draft-card.stories.tsx` | `Repost` / `RepostUnpublished` / `Hidden` | 枠の中の記事カード (子付きの再掲載、元の Digest が公開されていない再掲載、「表示に戻す」付きの隠した行) |
| `pages/digest-editor/ui/link-meta.stories.tsx` | `Registered` | 今の「既に登録済みです」(比べるため) |

`DraftCard` はサーバー関数を読み込むので Storybook に載せられない (`link-meta.stories.tsx` の既存コメント)。メニューとカテゴリの固定はデモに出さず、Phase 9 で編集画面を開いて確かめる。
