import { IsString, IsOptional, IsNumber, IsObject } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @IsOptional()
  sessionId?: string; // Track anonymous guests
}

export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  fontColor?: string;

  @IsOptional()
  @IsString()
  fontFamily?: string;

  @IsOptional()
  @IsObject()
  subtitleStyle?: object;

  @IsOptional()
  @IsString()
  bgStyle?: string;

  @IsOptional()
  @IsString()
  bgColor?: string;

  @IsOptional()
  @IsString()
  outline?: string;

  @IsOptional()
  @IsString()
  shadow?: string;

  @IsOptional()
  @IsString()
  subtitleAnim?: string;

  @IsOptional()
  @IsString()
  wordAnim?: string;

  @IsOptional()
  @IsNumber()
  subtitleFontSize?: number;

  @IsOptional()
  @IsNumber()
  maxLines?: number;

  @IsOptional()
  @IsNumber()
  lineSpacing?: number;

  @IsOptional()
  @IsString()
  fontAlign?: string;

  @IsOptional()
  @IsObject()
  subtitleBounds?: object;
}
