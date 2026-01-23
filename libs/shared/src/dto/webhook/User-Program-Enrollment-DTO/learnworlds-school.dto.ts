// learnworlds-school.dto.ts
import { IsOptional, IsString } from 'class-validator';

export class LearnWorldsSchoolDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  url?: string;
}
