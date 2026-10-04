# frontend UI デザインルール

参照: [Figma 基礎資料](https://www.figma.com/design/KIz51olPtwpG8lU3xObA8s/times?node-id=12-4)
値の正は `frontend/src/app/styles/global.css` のトークン。ここには値を書かない。

## 原則

- 白背景 + 1px 境界線を基本にする。カード、入力欄、メニュー、ログインカードすべて同じ。
- 状態は枠線・背景の濃淡・小さな影・ステータスドットだけで表す。グラデーション、強い影、背景色の変化による強調は使わない。
- 操作領域 (入力欄・ボタン) は角丸で区切り、本文や一覧と見た目で区別する。
- 色・影・角丸・余白はトークンで指定する。CSS Modules に生の値を書かない。
- 余白は 8 の倍数。画面パディングとセクション間は `--space-4`、カード内は `--space-2` 〜 `--space-3`。

## トークン対応表

| 用途 | トークン |
|---|---|
| 主テキスト (タイトル・本文・操作ラベル) | `--color-text` |
| カード本文 | `--color-text-secondary` |
| カテゴリ見出し・日時・プレースホルダー | `--color-text-muted` |
| メタ情報・メニューの補助ラベル | `--color-text-faint` |
| 境界線 | `--color-border` |
| セカンダリ操作の背景 (ログアウト等) | `--color-fill-subtle` |
| 帯・薄い面 (ヘッダー帯、注記ボックス) | `--color-fill-faint` |
| 稼働・接続を示すドット | `--color-status` |
| 浮上させるカード | `--shadow-raised` |
| ドロップダウンメニュー | `--shadow-menu` |
| 記事カード | `--radius-card` |
| 入力欄・ボタン・下書き・メニュー | `--radius-control` |
| ログインカード・大枠パネル | `--radius-panel` |

## タイポグラフィ

フォントは Klee One (body で指定済み)。用途別に `global.css` のクラスを使う。CSS Modules からは `composes: t-title from global;` で取り込む。

| 用途 | クラス | サイズ / ウェイト |
|---|---|---|
| 日付見出し | `.t-date` | 18px / 600 |
| カテゴリ見出し | `.t-label` | 14px / 600 |
| 記事タイトル | `.t-title` | 16px / 400 / line-height 24px |
| カード本文 | `.t-body` | 13px / 400 / line-height 1.5 |
| メタ (ドメイン・時刻) | `.t-meta` | 11px |

複数ページで同じ複合ブロック (見出し + メタなど) が出るまで React コンポーネントには昇格させない。

## レスポンシブ

- モバイル (`--mobile`) では入力欄と追加ボタンを 1 行にまとめ、カードはタイトル優先で短くする。
- 白背景・境界線・角丸・トークンは PC とモバイルで共通。
