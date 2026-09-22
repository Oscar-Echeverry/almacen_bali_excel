import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Device, DeviceEnrollmentToken, User } from "../database/entities";
import { SecurityModule } from "../security/security.module";
import { DeviceGuard } from "./device.guard";
import { DevicesController } from "./devices.controller";
import { DevicesService } from "./devices.service";

@Module({
  imports: [TypeOrmModule.forFeature([Device, DeviceEnrollmentToken, User]), SecurityModule],
  controllers: [DevicesController],
  providers: [DevicesService, DeviceGuard],
  exports: [DevicesService, DeviceGuard]
})
export class DevicesModule {}
