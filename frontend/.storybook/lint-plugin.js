// oxlint には no-restricted-syntax がないので、story のデータを parse に直接渡す形だけを止める
// oxlint は JS plugin の node と context の型を公開していない
/* oxlint-disable typescript/no-unsafe-assignment, typescript/no-unsafe-member-access, typescript/no-unsafe-call, typescript/no-unsafe-return, typescript/no-unsafe-argument, typescript/strict-boolean-expressions */
const PARSE = new Set(["parse", "safeParse", "parseAsync", "safeParseAsync"]);

const isLiteralNode = (n) => n?.type === "ObjectExpression" || n?.type === "ArrayExpression";

const isLiteral = (context, node, arg) => {
  if (isLiteralNode(arg)) {
    return true;
  }
  if (arg?.type !== "Identifier") {
    return false;
  }
  for (let scope = context.sourceCode.getScope(node); scope; scope = scope.upper) {
    const variable = scope.set.get(arg.name);
    if (variable) {
      return variable.defs.some((d) => isLiteralNode(d.node.init));
    }
  }
  return false;
};

export default {
  meta: { name: "storybook-local" },
  rules: {
    "no-parse-literal": {
      create: (context) => ({
        CallExpression(node) {
          const [arg] = node.arguments;
          if (
            node.callee.type === "MemberExpression" &&
            PARSE.has(node.callee.property.name) &&
            isLiteral(context, node, arg)
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
