# 有効にするルール ID の宣言ファイル。
#
# 取得元は flake.nix の flake = false な input（rev は flake.lock に固定）。
# ID 一覧は `just rules-list` で確認できる。不要なものは行ごと消す。
[
  # Hol1kgmg/rules
  "code-comment"

  # ./rules（独自）
  "frontend-ui-design"
  "quality"
]
