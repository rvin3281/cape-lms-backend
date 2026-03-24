import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateFacilitatorDto {
  @IsString()
  @IsNotEmpty()
  facilitatorName: string;
}
