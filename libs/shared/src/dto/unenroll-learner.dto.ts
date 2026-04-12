import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export enum ProgramSourceEnum {
  CLASSROOM = 'CLASSROOM',
  HYBRID = 'HYBRID',
}

export class UnenrollProgramItemDto {
  @IsString()
  @IsNotEmpty()
  programId: string;

  @IsOptional()
  @IsString()
  enrollmentId?: string | null;

  @IsEnum(ProgramSourceEnum)
  source: ProgramSourceEnum;
}

export class UnenrollUserProgramsDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UnenrollProgramItemDto)
  programs: UnenrollProgramItemDto[];
}
