import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreateAdminUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @IsNotEmpty()
  fullName!: string;
}
