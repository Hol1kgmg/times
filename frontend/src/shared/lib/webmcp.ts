import type { z } from "zod";
import { prettifyError, toJSONSchema } from "zod";

export type Tool<I extends z.ZodType> = Omit<WebMCP.ModelContextTool, "inputSchema" | "execute"> & {
  input: I;
  execute: (
    input: z.infer<I>,
    options: WebMCP.ToolExecuteCallbackOptions,
  ) => string | Promise<string>;
};

export const defineTool = <I extends z.ZodType>(tool: Tool<I>) => tool;

export const registerTool = async <I extends z.ZodType>(tool: Tool<I>, signal: AbortSignal) => {
  const context = document.modelContext;
  if (context === undefined) {
    return;
  }
  const { input, execute, ...meta } = tool;
  const { $schema: _, ...inputSchema } = toJSONSchema(input);
  try {
    await context.registerTool(
      {
        ...meta,
        inputSchema,
        // ブラウザは inputSchema に照らさず、throw した文はエージェントに届かないので、検証の失敗は isError で返す
        execute: async (raw, options) => {
          const parsed = input.safeParse(raw);
          if (!parsed.success) {
            return {
              content: [{ type: "text", text: prettifyError(parsed.error) }],
              isError: true,
            };
          }
          return { content: [{ type: "text", text: await execute(parsed.data, options) }] };
        },
      },
      { signal },
    );
  } catch (error) {
    // 登録の途中で画面を離れて外した失敗は、外したかった結果と同じ
    if (!signal.aborted) {
      throw error;
    }
  }
};
