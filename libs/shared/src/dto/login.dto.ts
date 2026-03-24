import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';
import { ROLE_CODE } from '../constant';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @IsIn([
    ROLE_CODE.INDIVIDUAL_LEARNER,
    ROLE_CODE.HYBRID_LEARNER,
    ROLE_CODE.CLASSROOM_LEARNER,
    ROLE_CODE.CAPE_ADMIN,
    ROLE_CODE.HR_FOCAL_ADMIN,
  ])
  roleCode: string;
}
