import { IsEmail, IsOptional, IsString } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  // Add more fields here as the User model grows (e.g., name, avatarUrl, etc.)
  @IsOptional()
  @IsString()
  name?: string;
}
