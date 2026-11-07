# 派生先が管理。enable で追加、disable で除外。adr/from-template/0005
# ID 一覧は `just rules-list`。
{
  enable = [
    # Hol1kgmg/rules
    "code-comment"

    # ./rules（独自）
    "frontend-ui-design"
    "quality"
    "typescript-app"
  ];

  disable = [
  ];
}
