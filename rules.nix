# 有効にするルール ID の宣言ファイル。
#
# 取得元は registry/rules/*.nix（rev は registry/rules.lock.json に固定）。
# ID 一覧は `just rules-list` で確認できる。不要なものは行ごと消す。
[
  # registry/rules/hol1kgmg.nix
  "code-comment"

  # ./rules（独自）
  "frontend-ui-design"
]
