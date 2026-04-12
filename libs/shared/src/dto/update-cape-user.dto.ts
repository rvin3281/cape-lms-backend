import { Type } from 'class-transformer';
import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class UnenrollUserDto {
  @IsString()
  @IsIn(['HYBRID', 'CLASSROOM'])
  type!: 'HYBRID' | 'CLASSROOM';

  @IsOptional()
  @IsString()
  @MaxLength(128)
  productId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  programId?: string;
}

export class UpdateCapeUserLearnworldsDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  userName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  cfCompany?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  cfCohort?: string;

  @IsOptional()
  @IsString()
  @IsIn(['HYBRID_LEARNER', 'CLASSROOM_LEARNER'])
  roleCode?: 'HYBRID_LEARNER' | 'CLASSROOM_LEARNER';

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => UnenrollUserDto)
  unenroll?: UnenrollUserDto;
}

export class UpdateCapeUserDto {
  @IsString()
  @MaxLength(200)
  firstName: string;

  @IsString()
  @MaxLength(200)
  lastName: string;

  @IsString()
  @MinLength(3)
  @MaxLength(150)
  userName: string;

  @IsString()
  @MaxLength(255)
  cfCompany: string;
}
