import { IsNumber, IsOptional, IsString, IsArray } from 'class-validator';

export class UpdatePlanDto {
  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsNumber()
  daysCovered?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  benefits?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  limitations?: string[];
}
