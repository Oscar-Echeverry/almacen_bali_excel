import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { Injectable } from "@nestjs/common";
import { appConfig } from "../config/app-config";

export interface EncryptedFileMetadata {
  path: string;
  fileIv: string;
  fileTag: string;
  dekIv: string;
  dekTag: string;
  dekEncrypted: string;
}

export interface EncryptedStringPayload {
  iv: string;
  tag: string;
  ciphertext: string;
}

@Injectable()
export class CryptoService {
  private readonly masterKey: Buffer;

  constructor() {
    this.masterKey = this.loadMasterKey();
  }

  randomToken(bytes = 32): string {
    return randomBytes(bytes).toString("base64url");
  }

  sha256Hex(value: Buffer | string): string {
    return createHash("sha256").update(value).digest("hex");
  }

  hashToken(token: string): string {
    return this.sha256Hex(token);
  }

  encryptString(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.masterKey, iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    const payload: EncryptedStringPayload = {
      iv: iv.toString("hex"),
      tag: cipher.getAuthTag().toString("hex"),
      ciphertext: encrypted.toString("base64")
    };
    return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  }

  decryptString(payloadBase64: string): string {
    const payload = JSON.parse(Buffer.from(payloadBase64, "base64url").toString("utf8")) as EncryptedStringPayload;
    const decipher = createDecipheriv("aes-256-gcm", this.masterKey, Buffer.from(payload.iv, "hex"));
    decipher.setAuthTag(Buffer.from(payload.tag, "hex"));
    return Buffer.concat([
      decipher.update(Buffer.from(payload.ciphertext, "base64")),
      decipher.final()
    ]).toString("utf8");
  }

  encryptBufferToFile(buffer: Buffer, path: string): EncryptedFileMetadata {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    const dek = randomBytes(32);
    const fileIv = randomBytes(12);
    const fileCipher = createCipheriv("aes-256-gcm", dek, fileIv);
    const encryptedFile = Buffer.concat([fileCipher.update(buffer), fileCipher.final()]);
    writeFileSync(path, encryptedFile, { mode: 0o600 });

    const dekIv = randomBytes(12);
    const dekCipher = createCipheriv("aes-256-gcm", this.masterKey, dekIv);
    const encryptedDek = Buffer.concat([dekCipher.update(dek), dekCipher.final()]);

    return {
      path,
      fileIv: fileIv.toString("hex"),
      fileTag: fileCipher.getAuthTag().toString("hex"),
      dekIv: dekIv.toString("hex"),
      dekTag: dekCipher.getAuthTag().toString("hex"),
      dekEncrypted: encryptedDek.toString("base64")
    };
  }

  decryptFileToBuffer(metadata: EncryptedFileMetadata): Buffer {
    const dekDecipher = createDecipheriv("aes-256-gcm", this.masterKey, Buffer.from(metadata.dekIv, "hex"));
    dekDecipher.setAuthTag(Buffer.from(metadata.dekTag, "hex"));
    const dek = Buffer.concat([
      dekDecipher.update(Buffer.from(metadata.dekEncrypted, "base64")),
      dekDecipher.final()
    ]);

    const encryptedFile = readFileSync(metadata.path);
    const fileDecipher = createDecipheriv("aes-256-gcm", dek, Buffer.from(metadata.fileIv, "hex"));
    fileDecipher.setAuthTag(Buffer.from(metadata.fileTag, "hex"));
    return Buffer.concat([fileDecipher.update(encryptedFile), fileDecipher.final()]);
  }

  private loadMasterKey(): Buffer {
    if (existsSync(appConfig.masterEncryptionKeyFile)) {
      const raw = readFileSync(appConfig.masterEncryptionKeyFile);
      if (raw.length >= 32) {
        return createHash("sha256").update(raw).digest();
      }
    }
    if (appConfig.isProduction) {
      throw new Error("MASTER_ENCRYPTION_KEY_FILE is missing or too short");
    }
    return createHash("sha256").update("development-only-master-key-do-not-use-in-production").digest();
  }
}
