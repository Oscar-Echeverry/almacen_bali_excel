import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { CryptoService } from "../src/security/crypto.service";

describe("CryptoService", () => {
  it("encrypts and decrypts file content with AES-256-GCM envelope metadata", () => {
    const dir = mkdtempSync(join(tmpdir(), "ssw-crypto-"));
    const service = new CryptoService();
    const path = join(dir, "original.enc");
    const metadata = service.encryptBufferToFile(Buffer.from("confidential workbook"), path);
    expect(readFileSync(path, "utf8")).not.toContain("confidential workbook");
    expect(service.decryptFileToBuffer(metadata).toString("utf8")).toBe("confidential workbook");
  });

  it("fails GCM authentication when ciphertext is tampered", () => {
    const dir = mkdtempSync(join(tmpdir(), "ssw-crypto-"));
    const service = new CryptoService();
    const path = join(dir, "original.enc");
    const metadata = service.encryptBufferToFile(Buffer.from("safe"), path);
    const encrypted = readFileSync(path);
    const first = encrypted[0];
    if (first === undefined) {
      throw new Error("Encrypted fixture unexpectedly empty");
    }
    encrypted[0] = first ^ 1;
    writeFileSync(path, encrypted);
    expect(() => service.decryptFileToBuffer(metadata)).toThrow();
  });
});
