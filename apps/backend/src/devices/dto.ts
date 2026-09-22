import { IsString, Length } from "class-validator";

export class CreateEnrollmentTokenDto {
  @IsString()
  @Length(1, 120)
  userId!: string;
}

export class SubmitEnrollmentDto {
  @IsString()
  @Length(20, 256)
  token!: string;

  @IsString()
  @Length(2, 160)
  deviceName!: string;

  @IsString()
  @Length(100, 8192)
  csrPem!: string;
}
