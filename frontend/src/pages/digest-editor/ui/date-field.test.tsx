import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { DateField } from "./date-field";

const Harness = () => {
  const [value, setValue] = useState("2026-01-05");
  return (
    <>
      <DateField invalid={false} taken={new Set()} value={value} onChange={setValue} />
      <output>{value}</output>
    </>
  );
};

describe(DateField, () => {
  it("reports an empty date while a segment is cleared, without wiping the other segments", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const field = screen.getByRole("group", { name: "日付" });
    const value = screen.getByRole("status");

    await user.click(screen.getByRole("spinbutton", { name: /^日/u }));
    await user.keyboard("{Backspace}");
    expect(value).toBeEmptyDOMElement();
    expect(field).toHaveTextContent("2026/01/日");

    await user.keyboard("05");
    expect(value).toHaveTextContent("2026-01-05");
  });
});
