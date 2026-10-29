# 独自スキル

このリポジトリ固有のスキルを置く。`<skill-id>/SKILL.md` を作成し、`skills.nix` の `enable` に ID を追加すると `.agents/skills` へ同期される。

`speckit-*` は `specify init --integration claude` が `.claude/skills` に出力したもの。`specify integration upgrade` 後は `.agents/skills/speckit-*` をここへ移し、増えた ID を `skills.nix` に足す。
