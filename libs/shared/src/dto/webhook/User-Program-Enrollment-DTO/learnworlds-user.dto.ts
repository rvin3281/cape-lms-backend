// learnworlds-user.dto.ts
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class LearnWorldsUserDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  cf_cohort?: string;

  @IsOptional()
  @IsString()
  cf_company?: string;
}
