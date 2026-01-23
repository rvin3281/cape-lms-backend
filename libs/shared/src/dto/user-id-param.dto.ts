import { IsString } from 'class-validator';

export class UserIdParamDto {
  @IsString()
  id: string;
}
