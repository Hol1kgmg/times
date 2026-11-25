// oxlint には no-restricted-syntax がないので、story のデータを parse に直接渡す形だけを止める
// oxlint は JS plugin の node と context の型を公開していない
/* oxlint-disable typescript/no-unsafe-assignment, typescript/no-unsafe-member-access, typescript/no-unsafe-call */
export default {
  meta: { name: "storybook-local" },
  rules: {
    "no-parse-literal": {
      create: (context) => ({
        CallExpression(node) {
          const [arg] = node.arguments;
          if (
            node.callee.type === "MemberExpression" &&
            node.callee.property.name === "parse" &&
            (arg?.type === "ObjectExpression" || arg?.type === "ArrayExpression")
          ) {
            context.report({
              node,
              message:
                "parse の引数は unknown で、schema に足した必須の項目の欠けに型検査で気付けません。.storybook/fixture の fixture を使ってください",
            });
          }
        },
      }),
    },
  },
};
