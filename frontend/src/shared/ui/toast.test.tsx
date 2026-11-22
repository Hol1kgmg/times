import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { toast, Toaster } from "./toast";

describe(Toaster, () => {
  it("does not stack the same message while it is still shown", () => {
    render(<Toaster />);
    act(() => {
      toast.error("保存できませんでした");
      toast.error("保存できませんでした");
    });
    expect(screen.getAllByText("保存できませんでした")).toHaveLength(1);
  });
});
