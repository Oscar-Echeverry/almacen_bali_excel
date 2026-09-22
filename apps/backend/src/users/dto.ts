import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, Length } from "class-validator";

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(2, 160)
  name!: string;

  @IsString()
  @Length(12, 256)
  password!: string;

  @IsIn(["ADMIN", "EMPLOYEE"])
  role!: "ADMIN" | "EMPLOYEE";
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @Length(2, 160)
  name?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsBoolean()
  mfaEnabled?: boolean;
}

export class ResetPasswordDto {
  @IsString()
  @Length(12, 256)
  password!: string;

  @IsOptional()
  @IsBoolean()
  mustChangePassword?: boolean;
}
