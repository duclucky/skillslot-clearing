import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "./App";

describe("SkillSlot Clearing workspace", () => {
  it("shows an honest unconfigured state and both top-level destinations", async () => {
    render(<App />);

    expect(await screen.findByText("Contract not configured")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Clearing floor/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /My access & credits/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Connect wallet/i })).toBeDisabled();
  });

  it("does not expose reviewer internals or invented market state", async () => {
    const { container } = render(<App />);

    await screen.findByText("Contract not configured");
    expect(container).not.toHaveTextContent(/compatibility matrix/i);
    expect(container).not.toHaveTextContent(/attempt id/i);
    expect(container).not.toHaveTextContent(/sample round/i);
  });
});
