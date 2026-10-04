# 有効にするスキル ID の宣言ファイル。
#
# 取得元は registry/sources/*.nix（rev は registry/sources.lock.json に固定）。
# ID 一覧は `just skills-list` で確認できる。不要なものは行ごと消す。
# ./skills（独自）は flake.nix で全件自動有効になるのでここには書かない。
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

  # Hol1kgmg/skills（./skills にあった独自版を中央リポジトリ側へ移した）
  "dependabot-review"
  "speckit-explain"

  # addyosmani/web-quality-skills
  "web-quality-audit"
  "performance"
  "core-web-vitals"
  "accessibility"
  "seo"
  "best-practices"

  # Hol1kgmg/skills（必要なリポジトリで有効化する）
  # "dependabot-review"
  # "speckit-explain"

  # ./skills（独自）
]
