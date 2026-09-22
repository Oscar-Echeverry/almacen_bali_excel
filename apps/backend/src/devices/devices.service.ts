import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { HttpStatus, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import forge from "node-forge";
import { Repository } from "typeorm";
import { AuditService } from "../audit/audit.service";
import { ErrorCodeException } from "../common/error-code.exception";
import { appConfig } from "../config/app-config";
import { Device, DeviceEnrollmentToken } from "../database/entities";
import { CryptoService } from "../security/crypto.service";

export interface EnrollmentTokenResult {
  token: string;
  expiresAt: Date;
}

export interface EnrollmentSubmitResult {
  deviceId: string;
  status: string;
  certificatePem: string;
  certificateFingerprint: string;
}

@Injectable()
export class DevicesService {
  constructor(
    @InjectRepository(Device)
    private readonly devices: Repository<Device>,
    @InjectRepository(DeviceEnrollmentToken)
    private readonly tokens: Repository<DeviceEnrollmentToken>,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService
  ) {}

  list(): Promise<Device[]> {
    return this.devices.find({ relations: { user: true }, order: { createdAt: "DESC" } });
  }

  async createEnrollmentToken(userId: string, adminId: string): Promise<EnrollmentTokenResult> {
    const token = this.crypto.randomToken(32);
    const expiresAt = new Date(Date.now() + appConfig.enrollmentTokenTtlMinutes * 60_000);
    await this.tokens.save(this.tokens.create({
      userId,
      tokenHash: this.crypto.hashToken(token),
      expiresAt,
      usedAt: null,
      createdBy: adminId
    }));
    await this.audit.record({ eventType: "DEVICE_ENROLLMENT_REQUESTED", userId: adminId, resourceType: "user", resourceId: userId });
    return { token, expiresAt };
  }

  async submitEnrollment(token: string, deviceName: string, csrPem: string): Promise<EnrollmentSubmitResult> {
    const tokenHash = this.crypto.hashToken(token);
    const enrollmentToken = await this.tokens.findOne({ where: { tokenHash }, relations: { user: true } });
    if (!enrollmentToken || enrollmentToken.usedAt || enrollmentToken.expiresAt.getTime() < Date.now()) {
      throw new ErrorCodeException("AUTH_INVALID", "Token de enrollment inválido o expirado.", HttpStatus.FORBIDDEN);
    }
    const signed = this.signCsr(csrPem, enrollmentToken.user.email, deviceName);
    const device = await this.devices.save(this.devices.create({
      userId: enrollmentToken.userId,
      name: deviceName,
      certificateSerial: signed.serial,
      certificateFingerprint: signed.fingerprint,
      certificateSubject: signed.subject,
      status: "PENDING",
      approvedAt: null,
      approvedBy: null,
      revokedAt: null,
      revokedBy: null,
      lastIp: null,
      lastSeenAt: null,
      lastUserAgent: null
    }));
    enrollmentToken.usedAt = new Date();
    await this.tokens.save(enrollmentToken);
    await this.audit.record({ eventType: "DEVICE_ENROLLMENT_REQUESTED", userId: enrollmentToken.userId, deviceId: device.id });
    return {
      deviceId: device.id,
      status: device.status,
      certificatePem: signed.certificatePem,
      certificateFingerprint: signed.fingerprint
    };
  }

  async approve(deviceId: string, adminId: string): Promise<Device> {
    const device = await this.mustFind(deviceId);
    device.status = "APPROVED";
    device.approvedAt = new Date();
    device.approvedBy = adminId;
    await this.audit.record({ eventType: "DEVICE_APPROVED", userId: adminId, deviceId });
    return this.devices.save(device);
  }

  async revoke(deviceId: string, adminId: string): Promise<Device> {
    const device = await this.mustFind(deviceId);
    device.status = "REVOKED";
    device.revokedAt = new Date();
    device.revokedBy = adminId;
    await this.audit.record({ eventType: "DEVICE_REVOKED", userId: adminId, deviceId });
    return this.devices.save(device);
  }

  private async mustFind(deviceId: string): Promise<Device> {
    const device = await this.devices.findOne({ where: { id: deviceId } });
    if (!device) {
      throw new ErrorCodeException("DEVICE_NOT_APPROVED", "Dispositivo no encontrado.", HttpStatus.NOT_FOUND);
    }
    return device;
  }

  private signCsr(csrPem: string, userEmail: string, deviceName: string): { certificatePem: string; fingerprint: string; serial: string; subject: string } {
    if (!existsSync(appConfig.deviceCaKeyFile) || !existsSync(appConfig.deviceCaCertFile)) {
      if (appConfig.isProduction) {
        throw new Error("Device CA files are required");
      }
      throw new ErrorCodeException("DEVICE_REQUIRED", "CA de dispositivos no configurada.", HttpStatus.SERVICE_UNAVAILABLE);
    }
    const caKey = forge.pki.privateKeyFromPem(readFileSync(appConfig.deviceCaKeyFile, "utf8"));
    const caCert = forge.pki.certificateFromPem(readFileSync(appConfig.deviceCaCertFile, "utf8"));
    const csr = forge.pki.certificationRequestFromPem(csrPem);
    if (!csr.verify()) {
      throw new ErrorCodeException("DEVICE_REQUIRED", "CSR inválido.", HttpStatus.BAD_REQUEST);
    }
    if (!csr.publicKey) {
      throw new ErrorCodeException("DEVICE_REQUIRED", "CSR sin clave pública.", HttpStatus.BAD_REQUEST);
    }
    const cert = forge.pki.createCertificate();
    cert.publicKey = csr.publicKey;
    cert.serialNumber = randomBytes(16).toString("hex");
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    const attrs = [
      { name: "commonName", value: deviceName },
      { name: "emailAddress", value: userEmail },
      { shortName: "OU", value: "Secure Spreadsheet Devices" }
    ];
    cert.setSubject(attrs);
    cert.setIssuer(caCert.subject.attributes);
    cert.setExtensions([
      { name: "basicConstraints", cA: false },
      { name: "keyUsage", digitalSignature: true, keyEncipherment: true },
      { name: "extKeyUsage", clientAuth: true },
      { name: "subjectAltName", altNames: [{ type: 1, value: userEmail }] }
    ]);
    cert.sign(caKey, forge.md.sha256.create());
    const certificatePem = forge.pki.certificateToPem(cert);
    const der = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
    const fingerprint = this.crypto.sha256Hex(Buffer.from(der, "binary")).toUpperCase();
    return {
      certificatePem,
      fingerprint,
      serial: cert.serialNumber,
      subject: `CN=${deviceName},emailAddress=${userEmail}`
    };
  }
}
