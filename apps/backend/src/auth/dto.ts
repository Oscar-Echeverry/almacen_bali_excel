import { IsEmail, IsOptional, IsString, Length } from "class-validator";

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(8, 256)
  password!: string;

  @IsOptional()
  @IsString()
  mfaCode?: string;

  @IsOptional()
  @IsString()
  recoveryCode?: string;

  @IsOptional()
  @IsString()
  @Length(32, 256)
  browserDeviceToken?: string;

  @IsOptional()
  @IsString()
  @Length(2, 160)
  browserDeviceName?: string;
}

export class ChangePasswordDto {
  @IsString()
  @Length(8, 256)
  currentPassword!: string;

  @IsString()
  @Length(12, 256)
  newPassword!: string;
}
