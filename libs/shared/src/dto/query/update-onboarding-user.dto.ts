import { IsEmail, IsEnum, IsNotEmpty } from 'class-validator';

export enum OnboardingUpdateType {
  CAREER = 'career',
  ACCOUNT = 'account',
}

export class UpdateOnboardingUserDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsEnum(OnboardingUpdateType, {
    message: 'type must be either career or account',
  })
  @IsNotEmpty()
  type!: OnboardingUpdateType;
}
