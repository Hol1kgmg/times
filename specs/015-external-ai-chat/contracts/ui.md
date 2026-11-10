# UI Contract: 記事を外部の AI チャットで解説してもらう

外部に公開する API はない。部品どうしの受け渡しだけを決める。

## `DigestPost` (shared/ui/digest-post)

```ts
type DigestPostProps = { loadPreview: LoadPreview; action?: ReactNode } & (
  | {
      digest: Digest;
      onOpen?: (article: { id: ArticleId; url: string }) => void;
      // 渡したときだけ記事行に AI のアイコンを描く。shown はホバーできない環境でも出すかどうか
      ai?: { shown: boolean };
    }
  | { digest: DigestContent; onOpen?: never; ai?: never }
);
```

- 編集画面のプレビュー (`DigestContent`) は `ai` を渡せない (spec FR-016)
- 記事行 (親・子とも) は `ai` が渡されたとき、記事リンク・プレビュー・`AskAi` を 1 つのインライン要素 (ホバーの範囲) に入れ、その後ろに HOT の炎と吹き出しを置く。DOM の順は見た目と同じタイトル → AI のアイコン → 炎 → 吹き出し (research R3・R8)。`AskAi` は外から幅と見せ方を決められるよう `className` を受ける

## `AskAi` (shared/ui/ask-ai)

```ts
const AskAi: (props: { title: string; url: string; className?: string }) => JSX.Element;
```

- アイコンのボタン + 選択肢のカード (見出し「AI に解説」/ Claude・ChatGPT・Grok の横並び / プロンプトをコピー) + コピーの結果の表示
- ボタンとカード (`Dialog`) の読み上げの名前: `「{title}」を AI で解説`
- サービスは `Toolbar` の中の `href` (新しいタブ、`rel="noopener noreferrer"`) を持つリンク。見た目はロゴと名前、読み上げの名前は `{サービス名} で解説`
- カードを開くきっかけはボタンだけ。行のホバーやフォーカスで見せるかどうかは `DigestPost` が決め、`AskAi` はホバーの状態を外へ渡さない
- ボタンは `global.css` の `.icon-button` を取り込む (research R9)

## `AiToggle` (shared/ui/ai-toggle)

```ts
const AiToggle: (props: { isSelected: boolean; onChange: (selected: boolean) => void }) => JSX.Element;
```

- ホバーできない環境でだけ見える。読み上げの名前は状態によらず「AI のアイコンを表示」、状態は `aria-pressed`
- OFF: `bot-off` を `--color-text-muted`、ON: `bot-message-square` を `--color-accent`
- 見た目は `.icon-button` を取り込む (research R9)

## `CopyToast` (shared/ui/copy-toast)

```ts
const useCopyToast: () => { shown: boolean; show: () => void }; // show で 2 秒だけ shown
const CopyToast: (props: { shown: boolean; className?: string; children: ReactNode }) => JSX.Element;
```

- `children` はボタン。`shown` の間だけボタンの上に「コピーしました」を出し、`<output>` で読み上げる
- `digest-card` の Markdown のコピーボタンからここへ移す

## 純粋関数 (shared/lib/ai-chat)

```ts
type AiService = "claude" | "chatgpt" | "grok";
const aiPrompt: (article: { title: string; url: string }) => string;
const aiChatUrl: (service: AiService, prompt: string) => string;
```
