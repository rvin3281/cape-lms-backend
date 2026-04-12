/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class UpdateClassroomProgramFacilitatorDto {
  @IsString()
  @IsNotEmpty()
  facilitatorId: string;
}

export class UpdateClassroomProgramDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  programName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  programCohort: string;

  @IsDateString()
  programDate: string;

  @Transform(({ value }) => (typeof value === 'string' ? Number(value) : value))
  @IsInt()
  @Min(1)
  totalFacilitators: number;

  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return JSON.parse(value);
    }
    return value;
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpdateClassroomProgramFacilitatorDto)
  facilitators: UpdateClassroomProgramFacilitatorDto[];
}
