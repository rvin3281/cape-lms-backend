import { IsNotEmpty, IsString } from 'class-validator';

export class CohortIdParamDto {
  @IsString()
  @IsNotEmpty()
  id: string;
}
