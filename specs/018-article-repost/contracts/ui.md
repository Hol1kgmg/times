# Contract: UI の受け渡し

## 編集画面への戻し (サーバー関数 → route)

- `createDigest` / `updateDigest` は、`repostedUrls` が空でなければ `/admin/digests/$date/edit?reposted=<URL>&reposted=<URL>` へ redirect する。空ならいつもの遷移先 (作成で公開ならトップ、それ以外は一覧) のまま
- `admin.digests.$date.edit` の `validateSearch` は `z.object({ reposted: z.url().array().default([]) })` で検証する (URL パラメータの境界)
- 拒否の変換 (`rejection-of.ts`) に `{ reason: "repost-needs-child"; duplicateUrls: string[] }` を足す

## LinkMeta (編集画面の記事行のメタ行)

```ts
interface LinkMetaProps {
  host: string;
  untitled: boolean;
  suggested: boolean;
  registered: boolean;
  firstPublishedOn?: string; // "2026-10-03"。あれば「再掲載 · 10月3日(土)に初掲載」を faint で出す
  reposted: boolean; // 保存直後の再掲載。「再掲載として登録しました」を accent で出す
  needsChild: boolean; // 「再掲載には新しい記事を子に付けてください」を danger で出す
}
```

日付の文字は `formatEntryDate` と同じ形 (今年以外は年を付け、曜日も付ける) を「再掲載 · 〜に初掲載」に入れる。

## DigestPost (公開ページ・プレビューの投稿)

- 記事の型に `firstPublishedOn?: string` を足す (`Article` は生成型から、下書きの `NewArticle` 由来の型は任意で持つ)
- 親の記事行で `firstPublishedOn` があれば、タイトルの下にメタ行「再掲載」 (日付は出さない。日付は編集画面の LinkMeta だけ)(`.t-meta`、`--color-text-faint`) を出す。押せる要素にしない (FR-011)
- 子の記事行には出さない

## Storybook のデモ

| ファイル | story | 見せるもの |
|---|---|---|
| `shared/ui/digest-post.stories.tsx` | `Repost` | 再掲載の親 (「再掲載」) と新しい子 2 件。HOT 付きの再掲載を 1 件含め、炎・吹き出しと印が重ならないこと |
| `shared/ui/digest-post.stories.tsx` | `RepostWithAskAi` | `ai: { shown: true }` で AI のアイコンと印が並んでも崩れないこと |
| `pages/digest-editor/ui/link-meta.stories.tsx` | `Reposted` | 保存済みの再掲載 (印だけ) |
| `pages/digest-editor/ui/link-meta.stories.tsx` | `RepostNotice` | 保存直後 (印 + 「再掲載として登録しました」) |
| `pages/digest-editor/ui/link-meta.stories.tsx` | `RepostNeedsChild` | 子がなくて断られた行 |
| `pages/digest-editor/ui/link-meta.stories.tsx` | `Registered` | 今の「既に登録済みです」(比べるため) |

`DraftCard` はサーバー関数を読み込むので Storybook に載せられない (`link-meta.stories.tsx` の既存コメント)。記事行の見た目はメタ行の story で確かめる。
