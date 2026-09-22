import { Allow, ArrayMaxSize, IsArray, IsBoolean, IsInt, IsOptional, IsString, Matches, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export class CreateJobDto {
  @IsString()
  workbookId!: string;

  @IsString()
  assignedUserId!: string;

  @IsOptional()
  @IsBoolean()
  allowFormulaEditing?: boolean;

  @IsOptional()
  @IsBoolean()
  editEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  viewAccessEnabled?: boolean;
}

export class UpdateJobPermissionsDto {
  @IsOptional()
  @IsBoolean()
  editEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  allowFormulaEditing?: boolean;

  @IsOptional()
  @IsBoolean()
  viewAccessEnabled?: boolean;
}

export class CellPatchItemDto {
  @IsString()
  worksheetId!: string;

  @IsString()
  @Matches(/^[A-Z]{1,3}[1-9][0-9]{0,6}$/)
  cellAddress!: string;

  @Allow()
  newValue!: string | number | boolean | null;
}

export class PatchCellsDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CellPatchItemDto)
  changes!: CellPatchItemDto[];
}

export class RowsQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  start!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit!: number;
}
