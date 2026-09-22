import { randomBytes } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import * as argon2 from "argon2";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import { Repository } from "typeorm";
import { IsNull } from "typeorm";
import { appConfig } from "../config/app-config";
import { MfaRecoveryCode, User } from "../database/entities";
import { CryptoService } from "../security/crypto.service";

export interface MfaSetupResult {
  otpauthUrl: string;
  qrDataUrl: string;
  recoveryCodes: string[];
}

@Injectable()
export class MfaService {
  constructor(
    private readonly crypto: CryptoService,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(MfaRecoveryCode)
    private readonly recoveryCodes: Repository<MfaRecoveryCode>
  ) {}

  async beginSetup(user: User): Promise<MfaSetupResult> {
    const secret = authenticator.generateSecret();
    user.mfaSecretEncrypted = this.crypto.encryptString(secret);
    user.mfaEnabled = false;
    await this.users.save(user);
    const otpauthUrl = authenticator.keyuri(user.email, appConfig.totpIssuer, secret);
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl);
    const recoveryCodes = await this.replaceRecoveryCodes(user.id);
    return { otpauthUrl, qrDataUrl, recoveryCodes };
  }

  async enable(user: User, token: string): Promise<boolean> {
    if (!user.mfaSecretEncrypted) {
      return false;
    }
    const ok = authenticator.check(token, this.crypto.decryptString(user.mfaSecretEncrypted));
    if (!ok) {
      return false;
    }
    user.mfaEnabled = true;
    await this.users.save(user);
    return true;
  }

  verifyTotp(user: User, token: string): boolean {
    if (!user.mfaEnabled || !user.mfaSecretEncrypted) {
      return true;
    }
    return authenticator.check(token, this.crypto.decryptString(user.mfaSecretEncrypted));
  }

  async consumeRecoveryCode(user: User, code: string): Promise<boolean> {
    const active = await this.recoveryCodes.find({ where: { userId: user.id, usedAt: IsNull() } });
    for (const candidate of active) {
      if (await argon2.verify(candidate.codeHash, code)) {
        candidate.usedAt = new Date();
        await this.recoveryCodes.save(candidate);
        return true;
      }
    }
    return false;
  }

  private async replaceRecoveryCodes(userId: string): Promise<string[]> {
    await this.recoveryCodes.delete({ userId });
    const codes = Array.from({ length: 10 }, () => randomBytes(5).toString("hex").toUpperCase());
    const entities: MfaRecoveryCode[] = [];
    for (const code of codes) {
      entities.push(this.recoveryCodes.create({
        userId,
        codeHash: await argon2.hash(code, { type: argon2.argon2id })
      }));
    }
    await this.recoveryCodes.save(entities);
    return codes;
  }
}
