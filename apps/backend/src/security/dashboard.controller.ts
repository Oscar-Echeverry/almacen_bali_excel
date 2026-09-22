import { Controller, Get, UseGuards } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { MoreThan, Repository } from "typeorm";
import { AuthGuard } from "../auth/auth.guard";
import { Roles } from "../auth/roles.decorator";
import { AuditLog, Device, Job, User } from "../database/entities";

@UseGuards(AuthGuard)
@Roles("ADMIN")
@Controller("admin/dashboard")
export class DashboardController {
  constructor(
    @InjectRepository(Job) private readonly jobs: Repository<Job>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Device) private readonly devices: Repository<Device>,
    @InjectRepository(AuditLog) private readonly auditLogs: Repository<AuditLog>
  ) {}

  @Get()
  async dashboard(): Promise<Record<string, number>> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [
      activeJobs,
      submittedJobs,
      activeEmployees,
      pendingDevices,
      revokedDevices,
      securityEvents24h,
      failedLogins,
      copyAttempts,
      printAttempts,
      rejectedDevices
    ] = await Promise.all([
      this.jobs.count({ where: [{ status: "ASSIGNED" }, { status: "IN_PROGRESS" }] }),
      this.jobs.count({ where: { status: "SUBMITTED" } }),
      this.users.count({ where: { role: "EMPLOYEE", active: true } }),
      this.devices.count({ where: { status: "PENDING" } }),
      this.devices.count({ where: { status: "REVOKED" } }),
      this.auditLogs.count({ where: { timestamp: MoreThan(since) } }),
      this.auditLogs.count({ where: { eventType: "LOGIN_FAILED", timestamp: MoreThan(since) } }),
      this.auditLogs.count({ where: { eventType: "COPY_ATTEMPT", timestamp: MoreThan(since) } }),
      this.auditLogs.count({ where: { eventType: "PRINT_ATTEMPT", timestamp: MoreThan(since) } }),
      this.auditLogs.count({ where: { eventType: "DEVICE_REJECTED", timestamp: MoreThan(since) } })
    ]);
    return {
      activeJobs,
      submittedJobs,
      activeEmployees,
      pendingDevices,
      revokedDevices,
      securityEvents24h,
      failedLogins,
      copyAttempts,
      printAttempts,
      rejectedDevices
    };
  }
}
