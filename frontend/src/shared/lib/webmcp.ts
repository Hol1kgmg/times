import type { z } from "zod";
import { toJSONSchema } from "zod";

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
        // エージェントからの入力は信頼境界の外にある
        execute: async (raw, options) => ({
          content: [{ type: "text", text: await tool.execute(tool.input.parse(raw), options) }],
        }),
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
