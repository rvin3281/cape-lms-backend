import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CapeOnboardingProfileDto {
  @IsString({ message: 'First name must be a valid text value.' })
  @IsNotEmpty({ message: 'First name is required.' })
  firstName: string;

  @IsString({ message: 'Last name must be a valid text value.' })
  @IsNotEmpty({ message: 'Last name is required.' })
  lastName: string;

  @IsEmail({}, { message: 'Please enter a valid email address.' })
  @IsNotEmpty({ message: 'Email address is required.' })
  email: string;

  @IsString({ message: 'Phone number must be a valid text value.' })
  @IsNotEmpty({ message: 'Phone number is required.' })
  phoneNumber: string;

  @IsString({ message: 'Organization name must be a valid text value.' })
  @IsNotEmpty({ message: 'Organization name is required.' })
  organization: string;

  @IsString({ message: 'Job title must be a valid text value.' })
  @IsNotEmpty({ message: 'Job title is required.' })
  jobTitle: string;

  @IsString({ message: 'Current role must be a valid text value.' })
  @IsNotEmpty({ message: 'Current role is required.' })
  currentRole: string;

  @IsString({ message: 'Target role must be a valid text value.' })
  @IsNotEmpty({ message: 'Target role is required.' })
  targetRole: string;

  @IsString({ message: 'Industry must be a valid text value.' })
  @IsNotEmpty({ message: 'Industry is required.' })
  industry: string;

  @IsString({ message: 'Career goals must be a valid text value.' })
  @MinLength(10, {
    message: 'Career goals must be at least 10 characters long.',
  })
  @MaxLength(250, {
    message: 'Career goals must not exceed 250 characters.',
  })
  careerGoals: string;

  @IsArray({ message: 'Skills must be provided as a list.' })
  @ArrayMinSize(1, {
    message: 'Please add at least one skill.',
  })
  @IsString({
    each: true,
    message: 'Each skill must be a valid text value.',
  })
  skills: string[];
}
