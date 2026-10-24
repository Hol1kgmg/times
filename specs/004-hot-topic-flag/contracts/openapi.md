# Contract: openapi.yaml の差分

操作 (path) は増えない。`components.schemas` の 3 か所だけを変える。

## Category

```yaml
    # 固定 6 カテゴリ。表示順もこの順 (specs/001 FR-007、specs/004 FR-001)
    Category:
      type: string
      enum:
        - セキュリティ
        - IT系
        - UI系
        - AI系
        - 面白そうなツール・サービス
        - その他
      x-enum-varnames: [CategorySecurity, CategoryIT, CategoryUI, CategoryAI, CategoryTools, CategoryOther]
```

## Article (応答)

`required` に `hot` を足す。

```yaml
    Article:
      type: object
      required: [id, category, hot, title, url, children]
      properties:
        # ...既存...
        hot:
          type: boolean
          description: ホットトピックかどうか。子記事は親に従うので ChildArticle には持たない
```

## NewArticle (登録)

`required` には足さない。省略は false として扱う。

```yaml
    NewArticle:
      properties:
        # ...既存...
        hot:
          type: boolean
          default: false
```

`NewChildArticle` / `ChildArticle` は変えない。

## 検証の分担

| 入力 | 拒否する層 | 応答 |
|---|---|---|
| `category: "ホットトピック"` | OpenAPI validator (enum) | 400 Problem Details |
| `hot` が boolean 以外 | OpenAPI validator (type) | 400 Problem Details |
| `hot` の省略 | 拒否しない | handler が false として保存 |

どちらも既存の enum / type の自動検証なので、router テストは足さない (rules/quality.md「型が保証するものはテストしない」)。
