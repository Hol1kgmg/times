# 独自スキル

このリポジトリ固有のスキルを置く。`<skill-id>/SKILL.md` を作成すると `.agents/skills` へ同期される（`skills.nix` への追加は不要）。

`speckit-*` は `specify init --integration claude` が `.claude/skills` に出力したもの。`specify integration upgrade` 後は `.agents/skills/speckit-*` をここへ移す。
