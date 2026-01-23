// dto/learnworlds-sso.dto.ts
import { IsEmail, IsUrl } from 'class-validator';

export class LearnWorldsSsoDto {
  @IsEmail()
  email: string;

  @IsUrl()
  redirectUrl: string;
}
