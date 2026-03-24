/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class FacilitatorItemDto {
  [x: string]: any;
  @IsString()
  @IsNotEmpty()
  facilitatorId: string;
}

export class UserProgramOnboardingDto {
  @IsString()
  @IsNotEmpty()
  programName: string;

  @IsString()
  @IsNotEmpty()
  programCohort: string;

  // frontend sends ISO string
  @IsDateString()
  @IsNotEmpty()
  programDate: string;

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  totalFacilitators: number;

  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return plainToInstance(FacilitatorItemDto, parsed);
      } catch (error: any) {
        return value;
      }
    }
    return plainToInstance(FacilitatorItemDto, value);
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FacilitatorItemDto)
  facilitators: FacilitatorItemDto[];
}
