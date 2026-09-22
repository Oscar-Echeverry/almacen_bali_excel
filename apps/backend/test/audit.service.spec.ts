import { AuditService } from "../src/audit/audit.service";
import { AuditLog } from "../src/database/entities";
import { describe, expect, it, vi } from "vitest";

interface FakeManager {
  logs: AuditLog[];
  query: (sql: string) => Promise<void>;
  findOne: (entity: typeof AuditLog, options: unknown) => Promise<AuditLog | null>;
  create: (entity: typeof AuditLog, value: Partial<AuditLog>) => AuditLog;
  save: (entity: typeof AuditLog, value: AuditLog) => Promise<AuditLog>;
}

function fakeManager(): FakeManager {
  const logs: AuditLog[] = [];
  return {
    logs,
    query: vi.fn(async (_sql: string) => undefined),
    findOne: vi.fn(async (_entity: typeof AuditLog, _options: unknown) => logs[logs.length - 1] ?? null),
    create: vi.fn((_entity: typeof AuditLog, value: Partial<AuditLog>) => Object.assign(new AuditLog(), { id: `log-${logs.length + 1}`, ...value })),
    save: vi.fn(async (_entity: typeof AuditLog, value: AuditLog) => {
      logs.push(value);
      return value;
    })
  };
}

describe("AuditService", () => {
  it("verifies a valid HMAC audit chain and rejects altered metadata", async () => {
    const manager = fakeManager();
    const dataSource = {
      transaction: async <T>(callback: (m: FakeManager) => Promise<T>) => callback(manager)
    };
    const repo = {
      find: vi.fn(async () => manager.logs)
    };
    const service = new AuditService(dataSource as never, repo as never);
    await service.record({ eventType: "LOGIN_SUCCESS", userId: "user-1", metadata: { ok: true } });
    await service.record({ eventType: "JOB_SUBMITTED", userId: "user-1", resourceId: "job-1" });
    await expect(service.verifyIntegrity()).resolves.toMatchObject({ ok: true, checked: 2 });
    const first = manager.logs[0];
    if (!first) {
      throw new Error("Expected first audit log");
    }
    first.metadata = { ok: false };
    await expect(service.verifyIntegrity()).resolves.toMatchObject({ ok: false, brokenAt: "log-1" });
  });
});
