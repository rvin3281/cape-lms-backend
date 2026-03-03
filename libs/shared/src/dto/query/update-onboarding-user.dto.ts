import { IsEmail, IsNotEmpty } from 'class-validator';

export enum OnboardingUpdateType {
  CAREER = 'career',
  ACCOUNT = 'account',
}

export class UpdateOnboardingUserDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;
}
