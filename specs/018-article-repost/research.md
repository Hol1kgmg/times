# Research: 記事の再掲載と関連記事

## R1. 記事と掲載を分ける

- **Decision**: `articles` を記事そのもの (url, title, description, category, created_by, created_at) に絞り、掲載を `digest_articles (digest_id, article_id, parent_id, position, is_hot)` に移す。`article_links` は `digest_articles.parent_id` に吸収して消す。
- **Rationale**: 再掲載は「同じ記事がもう 1 つの Digest に載る」ことで、記事の行を増やさずに表せる (FR-001)。並び・HOT・親子が日ごとに変わる (FR-002)。日をまたいだ関連記事は `article_id` で引ける。
- **Alternatives considered**:
  - 再掲載の行を `articles` に複製し、`reposted_from` で元を指す: URL の一意性を部分 index に弱める必要があり、タイトルが日ごとにずれる
  - `article_links` の親を過去の Digest の記事にする: migration は要らないが、再掲載がその日の並びと HOT を持てず、子が記事に固定される (v1 の子が全期間で 1 つの集合になる)
  - URL の重複を許す (issue #81 の原案): 新しい記事に出会う体験が損なわれる

## R2. 親子と孫の禁止をどこで守るか

- **Decision**: 親は `FOREIGN KEY (digest_id, parent_id) REFERENCES digest_articles (digest_id, article_id)` で同じ Digest に縛る。孫は今と同じく API の形 (`ChildArticle` / `NewChildArticle` が children を持たない) で塞ぎ、DB では縛らない。
- **Rationale**: 書き込み口は `insertArticles` の 1 か所で、入力の形が 2 階層なので孫は作れない。DB で縛るには「親の parent_id が NULL」を見る複合 FK と生成列が要り、守るものに対して重い。
- **Alternatives considered**: トリガー、生成列 + 複合 FK。どちらも書き込み口が 1 つのうちは不要。

## R3. 子の並び順

- **Decision**: `position` は今と同じ Digest 内の通し番号 (親、その子、次の親…の順) にし、子の順は `position` の順で読む。`article_links.position` (親の中の順) は持たない。
- **Rationale**: 今の保存は子を親の直後に通し番号で入れているので、`position` の順と親の中の順は常に一致する。列を 1 つ減らせる。

## R4. 保存の流れ (作成・更新)

- **Decision**: トランザクションの中で次の順に行う。
  1. 送られた URL のうち、登録済みで、この Digest にまだ載っていない記事を引く (`ListNewlyAddedRegisteredArticles`)。あわせて、この Digest 以外の公開済み Digest に載っているかを引く
  2. 分類する (純粋関数 `classifyReposts`): 子として入れた → `url-already-registered`、公開済みの掲載がない → `url-already-registered`、子がない → `repost-needs-child`、子に登録済みの URL がある → その子が `url-already-registered`。どれにも当たらない親は再掲載
  3. この Digest の `digest_articles` を全部消す
  4. 記事を `articles` に upsert (`ON CONFLICT (created_by, url) DO UPDATE SET category, title`) し、`digest_articles` を入れ直す
  5. どの掲載もなくなった記事を消す (`DeleteOrphanArticles`)
- **Rationale**: `digest_articles` は外から id で参照されないので、全消しして入れ直してよい (今の `article_links` と同じ扱い)。記事の行は upsert で残るので id は保たれる (issue #114)。判定は 1 で「この Digest にまだ載っていない」記事に限るので、FR-009 (載っている再掲載は確かめ直さない) をそのまま満たす。
- **Alternatives considered**: 掲載を行ごとに upsert する。並べ替えの途中で position の unique がぶつかり、今と同じ DEFERRABLE の工夫が要る。全消しなら不要。
- **ponytail**: 判定 (1) と書き込み (4) の間に、別の保存が同じ URL を新規に入れると、その URL は判定を通らずに掲載される。管理者 1 人の前提で許容し、`ponytail:` コメントに残す。並行の保存が要るなら `LockDigestDates` と同じ advisory lock を URL にもかける。
- **ponytail**: 編集で、すでに載っている再掲載を子へ動かすと、2 の判定を通らない (FR-009 のため)。表示は子として正しく出るので許容する。

## R5. 「〜に掲載」の日付 (FR-010)

- **Decision**: 記事を読むクエリで、その記事が載っている公開済み Digest のうち、表示中の Digest より前の日付の最小値を `first_published_on` として返す。OpenAPI では `Article.firstPublishedOn` (date、任意)。子 (`ChildArticle`) には持たせない。
- **Rationale**: 保存せずに導けるので、元の Digest を下書きに戻した・削除した場合 (Edge Cases) も自動で追従する。前の日付に限ることで、元の日の Digest に後の再掲載の日付が出ない。子は新規の記事に限るので、前の掲載を持たない。

## R6. 再掲載したことを伝える (FR-006)

- **Decision**: 作成・更新のレスポンスを `SavedDigest` (`Digest` + `repostedUrls`) にする。サーバー関数は `repostedUrls` が空でなければ、いつもの遷移先 (トップ・一覧) ではなく、その Digest の編集画面へ `?reposted=<URL>...` 付きで移す。編集画面は該当の記事行のメタ行に「再掲載として登録しました」を出す。
- **Rationale**: 保存は成功時に redirect する作りで、遷移先のトップや一覧には記事行がない。編集画面に戻せば、案内を見たその場で行を外して保存し直せる (spec の「不要なら外す」)。どれが今回の保存で再掲載になったかは backend だけが知っている (R4 の 1) ので、レスポンスで返す。
- **Alternatives considered**:
  - 保存前に「再掲載になります」と出す: 確認の API が 1 つ増える。会話で後から伝える方に決めた
  - トースト 1 つで件数だけ伝える: どの行か分からず、外すときに探す必要がある
  - `Article.firstPublishedOn` から frontend で導く: 更新では、保存前から載っていた再掲載と区別できない

## R7. 表示の印の置き場所

- **Decision**: 公開ページ (`DigestPost`) では、再掲載の親の記事行のタイトルの下に、メタ行として「再掲載」(`.t-meta`、`--color-text-faint`) を出す。編集画面 (`LinkMeta`) では、ホスト名の後ろに「再掲載 · 10月3日(土)に初掲載」を faint で出し、保存直後の行には「再掲載として登録しました」(`--color-accent`、`AI が振り分けました` と同じ扱い) を足す。子がないための拒否は「再掲載には新しい記事を子に付けてください」(`--color-danger`、`既に登録済みです` と同じ扱い) で出す。
- **Rationale**: 公開ページの記事行のタイトルの後ろには、AI のアイコン・炎・吹き出しの幅の決まりがあり (frontend-ui-design のホットトピック・AI のアイコンの項)、そこへ文字を足すと折り返しとホバーの範囲の決まりが崩れる。下の行にすれば、それらに触れない。編集画面はもともとメタ行を持つので、そこに足す。
- **Storybook**: 見た目は `digest-post.stories.tsx` に `Repost` を、`link-meta.stories.tsx` に `Reposted` / `RepostNotice` / `RepostNeedsChild` を足して確かめる (contracts/ui.md)。

## R8. 件数とドメインの集計

- **Decision**: 件数 (`countArticles`、索引の記事数) は掲載の数で数える。再掲載も 1 件。ドメインの候補 (`ListArticleDomains`) は記事の数で数える (再掲載で同じ記事を 2 回数えない)。
- **Rationale**: 件数は「その日に載っている数」(spec Assumptions)。ドメインの候補は「よく登録するサイト」で、同じ記事の再掲載で増えるのは意味がない。

## R9. 移行と戻し

- **Decision**: `000013_split_digest_articles` で、今の `articles` の行ごとに `digest_articles` を 1 行作り (`parent_id` は `article_links` から)、その後で `article_links` と `articles.digest_id / position / is_hot` を消す。down は各記事のいちばん古い掲載を `articles` に戻し、ほかの掲載 (再掲載) は捨てる。
- **Rationale**: 今は記事 1 つにつき掲載 1 つなので、up は情報を失わない (FR-015)。down は再掲載を表せない形に戻すので、失うことを migration のコメントに 1 行残す。
