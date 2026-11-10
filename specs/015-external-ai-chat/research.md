# Research: 記事を外部の AI チャットで解説してもらう

## R1. 外部の AI チャットに文を入れた状態で開く URL

- **Decision**: Claude は `https://claude.ai/new?q=<文>`、ChatGPT は `https://chatgpt.com/?q=<文>`、Grok は `https://grok.com/?q=<文>` (ユーザーが対応を確認済み。未ログインでは入力欄に入らない)。文は `URLSearchParams` で符号化する。実装の後に、両方を実際に開いて文が入ることを quickstart で確かめる
- **Rationale**: どちらも公式の文書はなく、広く使われている非公式の入口。ChatGPT は 2025 年に、他サイトから開かれたときは自動で送信しないよう変わった (Tenable TRA-2025-22 への対応、`sec-fetch-site` で判定)。入力欄に入るだけで読み手が送る形になり、spec の「入力された状態」と合う。Claude の `?q=` は動かなくなったという報告もあるので、「プロンプトをコピー」を常に残す (spec FR-010)
- **Alternatives considered**: ChatGPT の `?prompt=` (拡張機能の独自仕様で、サイト本体の仕様ではない)。各社の API を呼んで答えをこちらで出す方法 (サーバーの費用と鍵の管理が増え、spec の「外部のチャットへ渡す」から外れる)

## R2. ホバーで開き、押しても開く選択肢のカード

- **Decision**: React Aria Components の `DialogTrigger` + `Popover` を、`isOpen` を自分で持つ形で使う。中身は「AI に解説」の見出し、`Toolbar` に入れた 3 つのサービスのリンク (ロゴ + 名前、左右キーで移る)、「プロンプトをコピー」の `Button` の 3 段。マウスで押されたときは `onOpenChange` を無視し、ホバーだけで開閉する (押して開いた形はホバーが外れても残り、違和感がある)。押した手段は外側の capture で `pointerType` を見て知る。タップ・キーボードのときはモーダルの Popover に `Dialog` を入れ、中身を react-aria の `FocusScope autoFocus` で包んで先頭の Claude にフォーカスする (子のフォーカスが先に入るので `Dialog` は自分へ移さない)。ホバーで開いたときは `isNonModal` にし、`Dialog` を使わずに同じ中身を `div` に入れる。カードを開くきっかけはアイコンのボタンだけで、記事リンクのホバーでは開かない。アイコンとカードのどちらからホバーが外れても、0.3s 待ってから閉じる。待っている間にどちらかへ戻れば閉じない。開いたときの形 (ホバー / 押下) は閉じるアニメーションの間も保ち、押して開いた形を閉じた後の 0.4s はアイコンを隠さない。押したときの縮み (`scale(0.9)`) はカードが開いていない間 (`:not([aria-expanded="true"])`) だけにする
- **Rationale**: RAC のトリガーは押下でしか開かない。ホバーで開くときにモーダルにすると、下敷きがページを覆ってスクロールを止める。`Dialog` は開くとフォーカスを自分へ移すので、ホバーで開いたときに使うと UI ルールの「部品はホバーでもフォーカスを移し、`:focus-visible` が枠を出す」問題が起きる。`Menu` は上下キーで移る縦の一覧で、横並びのサービスに合わない。閉じる途中で `Dialog` を外したり、閉じた直後にアイコンを `visibility: hidden` にしたりすると、RAC がフォーカスを戻す先がなくなって body に落ちる (モーダルの間は外側が `inert` なので、閉じた直後に手で `focus()` しても効かない)。待ち時間は、プレビューのカードの出る待ち (0.3s) と揃える。RAC はトリガーのボタンに開いている間も `data-pressed` を残すので、縮めたままだとホバーの判定まで 20×24 から 18×21.6 に縮み、縁に置いたカーソルが外れる → 0.3s 後に閉じる → 縮みが戻ってまた開く、を繰り返した。`Link` に直接 `autoFocus` を付けると、`Dialog` の中にあることを markuplint が部品をまたいで読めず、`a11y/no-autofocus-outside-dialog` に掛かる
- **Alternatives considered**: `MenuTrigger` + `Menu` で縦に並べる (サービスを 3 つにすると 4 行になり、行の近くに出るカードが本文を隠しすぎる)。`TooltipTrigger` (ツールチップの中に押せる要素を置けない)。CSS の隣接セレクタで出す (プレビューと同じ形。キーボード操作と読み上げを自前で書くことになる)。ホバーでは開かず押したときだけ開く (ユーザーの決定と異なる)。ロゴだけを並べる (押した先が分からない。ホバーで名前を出すとタッチ端末で読めない)

## R3. 行のアイコンの出し入れ

- **Decision**: アイコンのボタンは `visibility: hidden` で隠し、幅は常に取る (並べ方は R8)。記事リンク・プレビュー・AskAi を 1 つのインライン要素 (`.zone`) で包み、react-aria の `useHover` を付けて `data-hovered` を出す。見せる条件は 1 つのセレクタにまとめる: `.row:is([data-ai-shown], :has(.zone[data-hovered], .zone [data-focus-visible], .askAi [aria-expanded="true"], .askAi[data-holding]))`。ホバーできない環境では `data-hovered` が付かず、トグル (`data-ai-shown`) はホバーできる環境では出ないので、メディアクエリで分けない。炎と吹き出し (`.hot`) は `.zone` の外に置く。ホバーの判定の範囲は次のとおり: プレビューは記事リンクの文字だけ、AI のアイコンの出し入れと炎の揺れ・吹き出しは `.zone` (記事リンクから AI のアイコンまで)、カードの開閉は AI のアイコンのボタンだけ
- **Rationale**: `visibility: hidden` の要素は Tab で止まらない。ホバーできない環境で OFF の間に、見えないボタンへフォーカスが入らない。キーボードでは、リンクにフォーカスするとボタンが見え、次の Tab で止まれる。リンクとアイコンを 1 つのインライン要素に入れると、間の隙間と、タイトルが折り返した先の行も途切れずにホバーに含まれ、間を渡る待ち時間が要らない。`:focus-within` ではなく `[data-focus-visible]` を見るのは、タップやマウスのクリックでもフォーカスが来て、離れた後もアイコンが残るため。UI ルールに従い `:hover` は使わない
- **Alternatives considered**: `display: none` (幅が消え、出し入れで折り返しが変わる。SC-003 に反する)。`opacity: 0` (見えないボタンに Tab で止まる)。記事リンクと AskAi に別々にホバーを付けて、外れても 0.1s 待つ (当初の形。間のごく狭い隙間が判定から外れ、待ち時間で埋めていただけだった)。行全体のホバー (炎と吹き出しの上でもアイコンが出て目障り)

## R8. タイトル → AI のアイコン → 炎・HOT の並びを、折り返しを変えずに作る

- **Decision**: DOM の順も見た目と同じ「`.zone` (記事リンク → プレビュー → AskAi) → WORD JOINER (U+2060) → 炎 + 吹き出し (`.hot`)」にする。炎と吹き出しは記事リンクの外に置く (押しても記事は開かず、HOT はリンクと AI のアイコンの後ろの画像として読まれる)。AskAi の幅は HOT かどうかによらずタイトルの `::after` の 1 か所で予約し、AskAi は `margin-left` を負にして送り幅を 0 にし、その予約の上に重ねる。HOT の行では炎と吹き出しを普段 `translate` で AskAi の幅だけ左へ寄せて予約の上に置き、見せる間だけ `translate: 0` に戻す。AskAi と炎の間の WORD JOINER は、その間での改行を禁じる。幅は `digest-post.module.css` の custom property (`--ask-ai-width` / `--hot-width`) にアイコンの大きさと余白のトークンの `calc` で置く。WORD JOINER は整形ツールが文字列リテラルを見えない文字そのものに書き換えるので、`String.fromCodePoint` で作った定数にする。出現は `opacity` と、ボタン側の `scale` (左端を軸)、ずれは `translate`、どちらも 0.2s ease-out。reduced-motion では transition を止める
- **Rationale**: `translate`・`scale` はレイアウトを変えないので、行全体の幅・折り返し・行の高さがホバーの前後で同じになる (SC-003)。当たり判定は見た目の位置に付いて動く。普段寄せた炎は `translate` で重なりの上に描かれるので、予約の上でも当たり判定は炎に付き、`.zone` に入らない。ボタンはリンクの中に入れられない。予約をリンクの中に置き、AskAi は送り幅 0 で常に同じ行に収まり、炎は WORD JOINER で AskAi と離れないので、折り返すときは「予約・AskAi・炎」がまとまって次の行へ移る。DOM の順が見た目と同じなので、読み上げと Tab の順も見た目と一致する
- **Alternatives considered**: 炎と吹き出しを幅ごと押し出す (行末ぎりぎりのタイトルで、ホバーしたときだけ炎が次の行へ落ち、下の記事まで動く)。DOM の順を「リンク → 炎 → AskAi」にして AskAi を `position: relative` の `left` で炎の手前へ寄せ、予約を HOT の行では `.hot` の `padding-right` に置く (当初の形。読み上げの順が見た目と食い違い、予約の場所と寄せ方が HOT かどうかで分かれていた)。`order` や grid で並べ替える (インラインの折り返しの中では使えない)。AskAi の箱 (リンクの外) で幅を予約する (直前の要素との間で折り返し、AskAi だけ次の行へ落ちる)。WORD JOINER なしで並べる (炎だけ次の行へ落ちると、寄せた分だけ行頭からはみ出す)。AskAi の外側を `transform` で動かす (「コピーしました」の `position: fixed` の包含ブロックになり、アイコンの上に出られなくなった)
- **既知の上限**: 行に入るとずれが始まるので、0.2s が終わる前に炎のあたりを押すと、炎が離れた後の AskAi を押すことがある

## R4. トグルの状態を全日付で共有する

- **Decision**: 状態はページの部品 (`DigestCard` / `TimelinePage`) の `useState(false)` で 1 つ持ち、`DigestPost` に `ai={{ shown }}` として、トグルに `isSelected` / `onChange` として渡す
- **Rationale**: 共有する範囲がページ 1 つだけなので、Context やストアは要らない。保存しないので、読み直すと OFF に戻る (spec FR-015)
- **Alternatives considered**: `localStorage` に保存する (spec で保存しないと決めた)。モジュールの変数で全ページ共有 (ページを移っても残り、FR-015 と食い違う)

## R5. 編集画面のプレビューに出さないこと

- **Decision**: `DigestPost` の props の合併のうち、公開済みの `Digest` の側にだけ `ai?: { shown: boolean }` を足し、下書きの `DigestContent` の側は `ai?: never` にする。アイコンは `ai` が渡されたときだけ描き、`shown` はホバーできない環境でも出すかどうかを表す
- **Rationale**: specs/013 の `onOpen` と同じ形で、出さないことを型で押さえられる (spec FR-016)。「置くかどうか」と「出すかどうか」を別の階層に分け、値の意味を読み取りやすくする
- **Alternatives considered**: `onOpen` の有無で決める (計測とこの機能を結び付けてしまい、どちらかを外すともう一方も消える)。`aiShown?: boolean` 1 つで `undefined` / `false` / `true` の 3 つの意味を持たせる (当初の形。`undefined` が「置かない」を表すことが名前から読めない)

## R6. コピーの結果を示す

- **Decision**: トップの Markdown のコピーボタンの「コピーしました」(`digest-card` の `<output>` とその CSS) を `shared/ui/copy-toast` に切り出し、Markdown のコピーボタンとカードの「プロンプトをコピー」の両方で使う。カードはコピーしても閉じず、「コピーしました」はコピーボタンの上に出す。アンカーの名前は `anchor-scope` で部品の中に閉じる。`navigator.clipboard.writeText` が `NotAllowedError` で断られたときは示さない
- **Rationale**: 同じ形が 2 か所に出るので、コンポーネントに上げる条件を満たす。記事行には同じアンカーの名前が記事の数だけ並ぶので、`anchor-scope` がないと最後の 1 つにだけ寄る
- **Alternatives considered**: コピーボタンの文字を「コピーしました」に変える (ボタンの名前が変わると読み上げにも伝わりにくい)。コピーしたらカードを閉じてアイコンの上に出す (続けて AI チャットを選ぶ流れを切る。ユーザーの決定で閉じない)

## R7. アイコンの動き

- **Decision**: `bot-message-square` と `bot-off` を、既存の `shared/ui/icons/*.tsx` と同じ形で取り込む。行のアイコンはボタンのホバー (RAC の render props の `isHovered`) で `default` を 1 回動かす。トグルは切り替えのたびに、新しい状態のアイコンを 1 回動かす (OFF は `off` で斜線を引く)。`prefers-reduced-motion: reduce` では `animate` を渡さない。判定は `shared/lib/reduced-motion.ts` の `reducedMotion()` 1 か所にまとめ、既存の `date-picker.tsx` と `not-found/ui/sand-pile.tsx` もそれを使う
- **Rationale**: UI ルールの「アイコンは枠や行のホバーで 1 回だけ動かす」と炎の作りに揃える
- **Alternatives considered**: 動かさない (他のアイコンと振る舞いが揃わない)。motion の `MotionConfig reducedMotion="user"` で JS 側の判定を消す (motion が止めるのは transform 系だけで、アイコンごとに確かめる手間に見合わないので見送った)

## R9. アイコンだけのボタンの見た目

- **Decision**: Markdown のコピー・AI のトグル・行の AI のアイコンの 3 つのボタンは、`global.css` の `.icon-button` を `composes` する。地も枠も持たず `--color-text-muted`、ホバー (`[data-hovered]`) とフォーカス (`[data-focus-visible]`) で `--color-accent`、押すと `scale(0.9)` (カードが開いている間を除く)、色と縮みは 0.1s、reduced-motion で止める。各部品には固有の指定 (行の AI のアイコンの `height: 1lh` と左の余白、トグルの ON の色) だけを残す
- **Rationale**: 同じ形が 3 か所に出て、reduced-motion の止め忘れ (コピー)、色の切り替えの時間 (0.15s と 0.1s)、フォーカスの付け先 (`:focus-visible` と `[data-focus-visible]`) がずれていた
- **Alternatives considered**: ボタンの型 (`.button`) を使う (地と影が付き、日付の線や本文の中で目立ちすぎる)

## 既知の上限

- タッチとマウスの両方を持つ PC (`hover: hover` に一致する) では、指で触れても `useHover` がタッチを除くので、行のアイコンが出ない。マウスかキーボードでは使える。困ったら、トグルを `(hover: hover)` 以外にも出すかを見直す
