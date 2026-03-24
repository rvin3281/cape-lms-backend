import { IsNotEmpty, IsString } from 'class-validator';

export class AddFacilitatorDto {
  @IsString()
  @IsNotEmpty()
  facilitatorName: string;
}
