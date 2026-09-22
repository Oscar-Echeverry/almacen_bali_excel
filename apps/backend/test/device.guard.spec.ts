import { HttpException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { DeviceGuard } from "../src/devices/device.guard";
import { Device } from "../src/database/entities";

function context(session: Record<string, unknown>, headers: Record<string, string> = {}) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        session,
        ip: "127.0.0.1",
        header: (name: string) => headers[name] ?? headers[name.toLowerCase()]
      })
    })
  } as never;
}

describe("DeviceGuard", () => {
  it("allows an approved device bound to the session", async () => {
    const device = Object.assign(new Device(), {
      id: "device-1",
      userId: "user-1",
      status: "APPROVED",
      certificateFingerprint: "DEV-APPROVED"
    });
    const guard = new DeviceGuard(
      { findOne: vi.fn(async () => device), save: vi.fn(async (value: Device) => value) } as never,
      { fromRequest: vi.fn(async () => undefined) } as never,
      { isLockdownEnabled: vi.fn(async () => false) } as never
    );
    await expect(guard.canActivate(context({
      role: "EMPLOYEE",
      userId: "user-1",
      deviceId: "device-1",
      deviceFingerprint: "DEV-APPROVED"
    }))).resolves.toBe(true);
  });

  it("denies pending devices", async () => {
    const device = Object.assign(new Device(), {
      id: "device-1",
      userId: "user-1",
      status: "PENDING",
      certificateFingerprint: "DEV-APPROVED"
    });
    const guard = new DeviceGuard(
      { findOne: vi.fn(async () => device), save: vi.fn(async (value: Device) => value) } as never,
      { fromRequest: vi.fn(async () => undefined) } as never,
      { isLockdownEnabled: vi.fn(async () => false) } as never
    );
    await expect(guard.canActivate(context({
      role: "EMPLOYEE",
      userId: "user-1",
      deviceId: "device-1",
      deviceFingerprint: "DEV-APPROVED"
    }))).rejects.toBeInstanceOf(HttpException);
  });

  it("denies revoked devices", async () => {
    const device = Object.assign(new Device(), {
      id: "device-1",
      userId: "user-1",
      status: "REVOKED",
      certificateFingerprint: "DEV-APPROVED"
    });
    const guard = new DeviceGuard(
      { findOne: vi.fn(async () => device), save: vi.fn(async (value: Device) => value) } as never,
      { fromRequest: vi.fn(async () => undefined) } as never,
      { isLockdownEnabled: vi.fn(async () => false) } as never
    );
    await expect(guard.canActivate(context({
      role: "EMPLOYEE",
      userId: "user-1",
      deviceId: "device-1",
      deviceFingerprint: "DEV-APPROVED"
    }))).rejects.toBeInstanceOf(HttpException);
  });
});
