# 派生先が管理。enable で追加、disable で除外。adr/from-template/0005
# ID 一覧は `just skills-list`。
{
  enable = [
    # Hol1kgmg/skills
    "speckit-explain"

    # feature-sliced/skills
    "feature-sliced-design"

    # google/skills (Cloud Run + Cloud SQL へのデプロイ用)
    "gcloud"
    "cloud-run-basics"
    "cloud-sql-basics"
    "google-cloud-recipe-auth"

    # GoogleChromeLabs/webmcp-tools (adr/frontend/0014 の次の段階のツール設計用)
    "build-webmcp-tools"

    # ./skills（speckit-* は specify init が出力したもの。skills/README.md）
    "speckit-analyze"
    "speckit-checklist"
    "speckit-clarify"
    "speckit-constitution"
    "speckit-converge"
    "speckit-implement"
    "speckit-plan"
    "speckit-specify"
    "speckit-tasks"
    "speckit-taskstoissues"
  ];

  disable = [
  ];
}
