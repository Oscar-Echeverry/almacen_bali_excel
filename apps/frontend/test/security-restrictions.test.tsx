import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Watermark } from "../src/components/Watermark";
import { RestrictedToast } from "../src/components/Toast";
import { useSecurityRestrictions } from "../src/hooks/useSecurityRestrictions";

function Harness(): JSX.Element {
  useSecurityRestrictions("job", "job-1");
  return <RestrictedToast />;
}

describe("security UI", () => {
  it("shows a dynamic watermark", () => {
    render(<Watermark userName="Carlos Perez" deviceName="DEV-A81F" sessionPublicId="SES-239A" />);
    expect(document.querySelector(".watermark")).toBeInTheDocument();
  });

  it("blocks copy attempts and displays a message", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ csrfToken: "csrf" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) }));
    render(<Harness />);
    document.dispatchEvent(new Event("copy", { bubbles: true, cancelable: true }));
    await waitFor(() => expect(screen.getByText("Esta acción está restringida.")).toBeInTheDocument());
  });
});
