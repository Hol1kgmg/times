# 有効にするスキル ID の宣言ファイル。
#
# 取得元は registry/sources/*.nix（rev は registry/sources.lock.json に固定）。
# ID 一覧は `just skills-list` で確認できる。不要なものは行ごと消す。
[
  # anthropics/skills
  "frontend-design"
  "skill-creator"
  "webapp-testing"

  # vercel/ai
  "adr-skill"

  # gist
  "cognitive-rhythm-writing"
  "japanese-tech-writing"

  # feature-sliced/skills
  "feature-sliced-design"

  # google/skills (Cloud Run + Cloud SQL へのデプロイ用)
  "gcloud"
  "cloud-run-basics"
  "cloud-sql-basics"
  "google-cloud-recipe-auth"

  # ./skills（独自）は flake.nix で全件自動有効。ここに書かない。
]
