import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @IsOptional()
  sessionId?: string; // Used to claim guest projects
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;

  @IsString()
  @IsOptional()
  sessionId?: string; // Used to claim guest projects
}

export class GoogleLoginDto {
  @IsString()
  token: string; // ID Token or Access Token from Google OAuth2 Client

  @IsString()
  @IsOptional()
  sessionId?: string; // Used to claim guest projects
}
