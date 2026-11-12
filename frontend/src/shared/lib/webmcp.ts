import type { z } from "zod";
import { prettifyError, toJSONSchema } from "zod";

export interface Tool<I extends z.ZodType> {
  name: string;
  description: string;
  input: I;
  execute: (input: z.infer<I>, options: WebMCP.ToolExecuteCallbackOptions) => Promise<string>;
}

export const defineTool = <I extends z.ZodType>(tool: Tool<I>) => tool;

export const registerTool = async <I extends z.ZodType>(tool: Tool<I>, signal: AbortSignal) => {
  const context = document.modelContext;
  if (context === undefined) {
    return;
  }
  const { $schema: _, ...inputSchema } = toJSONSchema(tool.input);
  try {
    await context.registerTool(
      {
        name: tool.name,
        description: tool.description,
        inputSchema,
        // ブラウザは inputSchema に照らさず、throw した文はエージェントに届かないので、検証の失敗は isError で返す
        execute: async (raw, options) => {
          const input = tool.input.safeParse(raw);
          if (!input.success) {
            return { content: [{ type: "text", text: prettifyError(input.error) }], isError: true };
          }
          return { content: [{ type: "text", text: await tool.execute(input.data, options) }] };
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
