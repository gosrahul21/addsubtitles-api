import { IsString, IsOptional, IsNumber, IsObject } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @IsOptional()
  sessionId?: string; // Track anonymous guests
}

export class UpdateSettingsDto {
  @IsNumber()
  fontSize: number;

  @IsString()
  fontColor: string;

  @IsString()
  fontFamily: string;

  @IsNumber()
  zoomLevel: number;
}
