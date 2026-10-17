## 概要

記事登録機能で扱う**登録待ちitem 1件のデータモデル**（`DraftNewsItem`）の仕様。実装対象は `frontend/src/widgets/news-item-editor/types.ts`（現行の `EditableNewsItem`）。

システム処理（meta title取得）がセットした値と、ユーザー操作で書き換えた値を分けて保持する「初期値」機構を新規に追加する。あわせて、翻訳の実施有無と元記事の言語をitemが持つ。

## 型定義

```ts
type Language = "ja" | "en" | "other";

type FetchedSource = {
  url: Url;
  title: string;
  language: Language;
};

export type DraftNewsItem = {
  id: DraftNewsItemId;
  url: Url;
  title: string;
  category: Category | undefined;
  language: Language;
  fetchStatus: "succeeded" | "failed";
  translated: boolean;
  initial: FetchedSource;
};
```

`DraftNewsItemId` は `Branded<string, "DraftNewsItemId">`。

### フィールド定義

| フィールド | 意味 | 書き換え経路 |
|---|---|---|
| `id` | item識別子。`url` から独立させ、url編集で変わらないようにする | Create時のみ |
| `url` | 現在値 | 編集モーダル / 初期値に戻す |
| `title` | 現在値 | 編集モーダル / 翻訳 / 初期値に戻す |
| `category` | 割り当てカテゴリ。`undefined` は未割り当てプール所属 | D&D |
| `language` | 現在値。元記事の言語 | バッジクリック / 初期値に戻す |
| `fetchStatus` | meta title取得の成否 | Create時のみ |
| `translated` | 翻訳を実施したか | 翻訳成功 / 初期値に戻す |
| `initial` | システム処理がセットした値のスナップショット。**不変** | Create時のみ |

`entry_date` はitem単位ではなくフォーム共通の値のため、この型には含めない（送信時に全itemへ一括付与する）。

## 現行 `EditableNewsItem` からの差分

```ts
// 現行
export type EditableNewsItem = {
  url: Url;
  title: string;
  translatedTitle: string | undefined;
  category: Category | undefined;
  fetchStatus: "succeeded" | "failed";
};
```

| # | 差分 | 理由 |
|---|---|---|
| 1 | `EditableNewsItem` → `DraftNewsItem` にリネーム | 呼称の統一 |
| 2 | `id: DraftNewsItemId` を新設 | 編集モーダルで `url` 自体を編集するため、`url` を識別子にするとキーが変わってしまう（現行 `useNewsItemEditor.ts` は `translatingUrl` / `editingUrl` として `item.url` をキーにしている） |
| 3 | `translatedTitle` を廃止 | 確定事項「翻訳の原文保持: 保持しない」と矛盾していたため。翻訳は `title` を直接上書きする |
| 4 | `translated: boolean` を追加 | 翻訳の実施有無は `initial` との比較では判定できない（翻訳も手動編集も同じ `title` を書き換えるため） |
| 5 | `language: Language` を追加 | 翻訳要否の判定に使う。ユーザーによる訂正も可能にする |
| 6 | `initial: FetchedSource` を追加 | システム処理がセットした値へ復帰できるようにする（新規機能要件） |

## 初期値（initial）機構

| 項目 | 内容 |
|---|---|
| 性質 | システム処理（meta title取得）がセットした値のスナップショット |
| セットタイミング | Create時（meta title取得の完了時）の1回のみ |
| 対象フィールド | `url` / `title` / `language` |
| 可変性 | 不変。以降のユーザー操作では一切書き換わらない |

### 初期値に含めないもの

- **翻訳による `title` 上書き** — ユーザー操作による変更のため初期値ではない。翻訳後に「初期値に戻す」を実行すると、翻訳結果ではなく取得時点のtitleに戻る
- **編集モーダルでの変更**
- **`category`** — Create時は常に `undefined` 固定であり、未割り当てへ戻す操作はD&Dで既に可能なため対象外

### 「初期値に戻す」操作

- **粒度: item単位**。`url` / `title` / `language` をまとめて `initial` の値へ戻し、あわせて `translated` を `false` にリセットする
- フィールド単位の部分復帰は設けない
- UIの詳細（操作の置き場所、取得失敗itemでの抑止有無、未変更時のdisabled/非表示、確認ダイアログの有無）は実装時に調整する。いずれもデータ設計には影響しない

## 言語判定

### 実現方式

meta title取得と**同じHTMLに対して判定する**ため追加のfetchは不要。BFF（`routes/api/meta-title.ts`）が既に対象ページをサーバー側fetchしているので、そこに判定を相乗りさせる。

```
1. titleにひらがな/カタカナを含む       → "ja"   （langより優先）
2. <html lang> を見る
     ja*  → "ja"
     en*  → "en"
     それ以外の値 → "other"
3. langが無い・読めない場合、titleの文字種で決める
     CJK統合漢字を含む      → "ja"
     ASCIIラテン文字が主体   → "en"
     それ以外              → "other"
```

- かな判定の正規表現: `/[぀-ゟ゠-ヿ]/`（ひらがな + カタカナ）
- **ステップ1を `<html lang>` より優先する理由**: テンプレート由来で `lang="en"` のまま放置された日本語サイトが実在するため。かなが含まれる時点でtitleは日本語であり、サイト側の申告より確実
- **ステップ3で漢字を `"ja"` に倒す理由**: 漢字のみのtitle かつ lang無しのケースは、この用途では日本語である可能性が高い。中国語記事を誤判定しうるが発生確率が低く、誤判定時は手動修正できる
- `fetchStatus === "failed"`（titleが空）の場合は判定材料がないため `"other"` になる
- 判定結果は `initial.language` と現在値 `language` の両方に同じ値でセットする

### 判定対象は「サイト」ではなく「title」

翻訳が書き換えるのは `title` なので、「そのサイトが日本語か」より「そのtitleが日本語か」を判定する。日本語サイトに英語タイトルの記事があっても正しく判定できる。

### 精度の限界

| パターン | 挙動 |
|---|---|
| サイト名サフィックス（`"English title \| はてなブックマーク"`） | かなを含むため `"ja"` と誤判定する。**最大の弱点** |
| 取得失敗item | titleが空のため判定不能 → `"other"` |
| 固有名詞のみ（`"Claude Code"` 等） | `"en"` と判定され、翻訳が不要でも警告が出る |

**サフィックス除去の前処理は行わない**（確定）。バッジによる手動修正が救済策として機能し、前処理には正当なタイトルを削る副作用があるため。

### 手動修正

判定結果はバッジクリックで `ja` / `en` / `other` に変更でき、**即時反映**する（モーダルを介さない）。「編集はモーダル経由に統一」は保存/キャンセルの確定操作を要するテキスト編集についてのルールであり、3値の選択は誤操作しても1クリックで戻せるため即時反映で足りる。

## 翻訳フラグ

`translated: boolean` として明示的に保持する。`initial` との比較では判定できない（翻訳も手動編集も同じ `title` を書き換えるため）。

これにより、保留事項「未翻訳の疑いがあるitemの判定ロジック — TBD」が解消される。ヒューリスティックで「疑い」を推測する必要はなく、実施の有無を事実として持てる。

## item単位のCRUD

### Create（追加）

- **トリガー**: URL欄でEnter押下 / 「取得」ボタンクリック
- **事前条件**: URLが空でない・`new URL()` でパース可能・リスト内に同一urlが存在しない（重複時はブロックし警告表示）
- **初期値**:

| フィールド | 値 |
|---|---|
| `id` | 新規採番 |
| `url` | 入力されたURL |
| `title` | 取得成功時は `<title>` 抽出結果 / 失敗時は空文字 |
| `category` | `undefined`（未割り当てプールへ） |
| `language` | 判定結果 |
| `fetchStatus` | `"succeeded"` / `"failed"` |
| `translated` | `false` |
| `initial` | `{ url, title, language }` を同値でセット |

- 追加先は配列末尾（配列順が表示順を兼ねる）
- 副作用: URL入力欄をクリアしフォーカスを戻す

### Read（表示）

- **未割り当てプール**: `category === undefined` のitemを抽出
- **カテゴリ別エリア**: `CATEGORIES` の各値ごとに `category === <その値>` のitemを抽出（縦積み・タブなし）
- **空表示**: 対象エリアが0件のときプレースホルダー
- **派生表示**（レコード自体は不変）:
  - `title` が空 かつ `fetchStatus === "failed"` のとき「タイトル未取得」等のエラー表示
  - hoverで `useLinkPreview` / `FloatingLinkPreviewCard` によるプレビュー表示（別データソース）

### Update（更新）

| 経路 | 更新フィールド | 確定方式 |
|---|---|---|
| 編集モーダル | `url` / `title` | 「保存」時のみ反映、「キャンセル」は破棄 |
| 翻訳 | `title`（上書き）/ `translated` → `true` | 成功時のみ即時反映 |
| バッジクリック | `language` | 即時反映 |
| D&D（エリア間） | `category` | ドロップ時に即時反映 |
| D&D（エリア内） | 配列順（フィールド値ではない） | 即時反映 |
| 初期値に戻す | `url` / `title` / `language` / `translated` | item単位で一括 |

### Delete（削除）

- **個別削除**: 削除ボタンで即時1件除去。確認ダイアログなし（ローカル状態のみで実データに影響しないため）
- **一括削除**: 送信成功（201）時にリスト全体をクリア。送信失敗時はリストを保持

## 値の遷移

| 操作 | `url` | `title` | `language` | `translated` | `initial` |
|---|---|---|---|---|---|
| Create | セット | セット | 判定結果 | `false` | **セット（唯一の書き込み）** |
| 翻訳・成功 | — | 上書き | — | `true` | 不変 |
| 翻訳・失敗 | — | — | — | — | 不変 |
| 再翻訳 | — | 上書き | — | `true` のまま | 不変 |
| モーダル編集・保存 | 変更 | 変更 | — | 維持 | 不変 |
| モーダル編集・キャンセル | — | — | — | — | 不変 |
| バッジクリック | — | — | 変更 | — | 不変 |
| D&D | — | — | — | — | 不変 |
| 初期値に戻す | ← `initial` | ← `initial` | ← `initial` | `false` | 不変 |
| Delete | レコード消滅 | | | | |

翻訳後に手動でtitleを修正した場合、`translated` は `true` を維持する（「誤訳時は編集モーダルから手動修正する」に沿う）。

## 導出値（状態として持たない）

| 導出したい情報 | 式 |
|---|---|
| 編集済みか | `title !== initial.title \|\| url !== initial.url` |
| 言語判定を訂正したか | `language !== initial.language` |
| 翻訳ボタンのラベル | `translated ? "もう一度翻訳" : "翻訳する"` |

## 送信時の判定

### 警告（送信はブロックしない）

```
language !== "ja" && translated === false
```

`"en"` と `"other"` の両方を翻訳忘れの対象に含める。判定には**現在値**を使うため、バッジで訂正すると警告も追従する。

### 送信ブロック

未割り当て（`category === undefined`）のitemが1件でも残っている場合、または `items` が空の場合のみ `disabled`。（既存の確定事項どおり、変更なし）

## UI（バッジ）

itemコンポーネントにバッジを追加する。

```
┌──────────────────────────────────────────┐
│ [≡] Understanding React 19's new hooks   │
│     example.com ・ IT系  [EN] [翻訳済]     │  ···
└──────────────────────────────────────────┘
        ↑ クリックで ja / en / other を選択・即時反映
```

- `[JA]` / `[EN]` / `[その他]` — クリックで変更、即時反映
- `[翻訳済]` を併記し、警告が出ている/出ていない理由を可視化する
- `initial.language` と異なる場合に印を付けるか（`[EN*]` 等）は任意

## BFFへの影響

### `/api/meta-title`

レスポンスを拡張する。

```
{ title: string | null }
  ↓
{ title: string | null; language: "ja" | "en" | "other" }
```

### `/api/archive/register`

**変更なし。** `language` / `translated` / `initial` はいずれもeditor内部の状態であり、`RawNewsItem` には含めない。送信時は `DraftNewsItem` + フォームの `entryDate` から `RawNewsItem[]` へ変換する。

`Raw` プレフィックスは規約どおりBFF境界の型にのみ使い、editor内部の状態はドメイン型（Branded Type）で統一する。初期値スナップショットに `RawNewsItem` を流用しない理由:

1. `RawNewsItem` は `category` / `entry_date` を持つが、初期値として意味を持つのは `url` / `title` / `language` のみでフィールドが噛み合わない
2. 初期値はBFFレスポンスではなくローカル状態であり、`url` に至ってはBFF由来ですらなくユーザーの入力値
3. `RawNewsItem.url` は素の `string`、現在値は `Url`（Branded）のため、比較のたびに型が食い違い、`adapters.ts` 以外で禁止されている型変換が必要になる

## 実装時に調整する事項

- 「初期値に戻す」のUI詳細（操作の置き場所、取得失敗itemでの抑止有無、未変更時のdisabled/非表示、確認ダイアログの有無）
- バッジのスタイル、`initial.language` との差異表示の有無

## スコープ外

- 翻訳の実現方式（外部翻訳APIの選定、BFF経由の呼び出し方式）— TBD
- 作業途中の下書き保持（ブラウザリロード時の復元）— Phase1では未対応
- タッチ環境でのD&D代替手段 — Phase1スコープ外
