import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ApplicationSetting } from "../database/entities";

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(ApplicationSetting)
    private readonly settings: Repository<ApplicationSetting>
  ) {}

  async isLockdownEnabled(): Promise<boolean> {
    const setting = await this.settings.findOne({ where: { key: "LOCKDOWN_MODE" } });
    if (!setting) {
      return false;
    }
    return setting.value.enabled === true;
  }

  async setLockdown(enabled: boolean, userId: string): Promise<ApplicationSetting> {
    const setting = this.settings.create({
      key: "LOCKDOWN_MODE",
      value: { enabled },
      updatedBy: userId
    });
    return this.settings.save(setting);
  }
}
