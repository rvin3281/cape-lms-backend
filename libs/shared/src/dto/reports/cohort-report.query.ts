import { IsInt, IsOptional, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class CohortReportQueryDto {
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page: number;
}
