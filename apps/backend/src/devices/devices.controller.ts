import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { CurrentUser as CurrentUserValue } from "../auth/current-user.decorator";
import { Roles } from "../auth/roles.decorator";
import { Device } from "../database/entities";
import { CreateEnrollmentTokenDto, SubmitEnrollmentDto } from "./dto";
import { DevicesService, EnrollmentSubmitResult, EnrollmentTokenResult } from "./devices.service";

@Controller()
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @UseGuards(AuthGuard)
  @Roles("ADMIN")
  @Get("admin/devices")
  list(): Promise<Device[]> {
    return this.devices.list();
  }

  @UseGuards(AuthGuard)
  @Roles("ADMIN")
  @Post("admin/devices/enrollment-token")
  createToken(@CurrentUser() user: CurrentUserValue, @Body() dto: CreateEnrollmentTokenDto): Promise<EnrollmentTokenResult> {
    return this.devices.createEnrollmentToken(dto.userId, user.id);
  }

  @Post("enrollment/submit")
  submit(@Req() _req: Request, @Body() dto: SubmitEnrollmentDto): Promise<EnrollmentSubmitResult> {
    return this.devices.submitEnrollment(dto.token, dto.deviceName, dto.csrPem);
  }

  @UseGuards(AuthGuard)
  @Roles("ADMIN")
  @Post("admin/devices/:id/approve")
  approve(@CurrentUser() user: CurrentUserValue, @Param("id") id: string): Promise<Device> {
    return this.devices.approve(id, user.id);
  }

  @UseGuards(AuthGuard)
  @Roles("ADMIN")
  @Post("admin/devices/:id/revoke")
  revoke(@CurrentUser() user: CurrentUserValue, @Param("id") id: string): Promise<Device> {
    return this.devices.revoke(id, user.id);
  }
}
