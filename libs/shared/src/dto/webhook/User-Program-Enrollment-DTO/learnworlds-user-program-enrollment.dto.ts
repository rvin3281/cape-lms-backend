import { Type } from 'class-transformer';
import { IsOptional, ValidateNested } from 'class-validator';
import { LearnWorldsProductDto } from './learnworlds-product.dto';
import { LearnWorldsSchoolDto } from './learnworlds-school.dto';
import { LearnWorldsUserDto } from './learnworlds-user.dto';

export class LearnWorldsUserProgramEnrollmentDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => LearnWorldsProductDto)
  bundle?: LearnWorldsProductDto;

  @ValidateNested()
  @Type(() => LearnWorldsProductDto)
  product: LearnWorldsProductDto;

  @ValidateNested()
  @Type(() => LearnWorldsUserDto)
  user: LearnWorldsUserDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => LearnWorldsSchoolDto)
  school?: LearnWorldsSchoolDto;
}
