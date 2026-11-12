import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { defineTool, registerTool } from "./webmcp";

describe(registerTool, () => {
  it("tells the agent what was wrong with its input instead of running the tool", async () => {
    const registered = vi.fn<WebMCP.ModelContext["registerTool"]>().mockResolvedValue();
    Object.defineProperty(document, "modelContext", {
      configurable: true,
      value: { registerTool: registered },
    });
    const execute = vi.fn<() => Promise<string>>().mockResolvedValue("moved");
    await registerTool(
      defineTool({
        name: "navigate",
        description: "d",
        input: z.object({ to: z.enum(["/a"]) }),
        execute,
      }),
      new AbortController().signal,
    );
    const [[tool]] = registered.mock.calls;
    const result = await tool.execute({ to: "/nope" }, { signal: new AbortController().signal });
    const failure = z
      .object({ isError: z.literal(true), content: z.tuple([z.object({ text: z.string() })]) })
      .parse(result);
    expect(failure.content[0].text).toContain("to");
    expect(execute).not.toHaveBeenCalled();
  });
});
