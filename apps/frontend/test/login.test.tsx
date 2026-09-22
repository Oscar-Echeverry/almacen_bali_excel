import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LoginPage } from "../src/pages/LoginPage";

describe("LoginPage", () => {
  it("renders login fields", () => {
    render(<LoginPage onLogin={() => undefined} />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Contraseña")).toBeInTheDocument();
  });

  it("submits credentials", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ csrfToken: "csrf" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "u1", role: "ADMIN", sessionPublicId: "SES-1", deviceId: null }) });
    vi.stubGlobal("fetch", fetchMock);
    const onLogin = vi.fn();
    render(<LoginPage onLogin={onLogin} />);
    await userEvent.type(screen.getByLabelText("Email"), "admin@example.local");
    await userEvent.type(screen.getByLabelText("Contraseña"), "ChangeMeAdmin123!");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(onLogin).toHaveBeenCalledWith(expect.objectContaining({ role: "ADMIN" }));
  });
});
