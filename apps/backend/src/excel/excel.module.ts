import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CellChange, Device, Job, Notification, User, WorkbookEntity, Worksheet } from "../database/entities";
import { DevicesModule } from "../devices/devices.module";
import { SecurityModule } from "../security/security.module";
import { ExcelController } from "./excel.controller";
import { ExcelService } from "./excel.service";

@Module({
  imports: [TypeOrmModule.forFeature([WorkbookEntity, Worksheet, Job, CellChange, Device, User, Notification]), SecurityModule, DevicesModule],
  controllers: [ExcelController],
  providers: [ExcelService],
  exports: [ExcelService]
})
export class ExcelModule {}
