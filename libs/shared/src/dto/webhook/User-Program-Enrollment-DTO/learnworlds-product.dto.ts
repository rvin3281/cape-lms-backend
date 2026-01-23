// learnworlds-product.dto.ts
import { IsInt, IsOptional, IsString, IsUrl } from 'class-validator';

export class LearnWorldsProductDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  type?: string; // course | learning_program | bundle

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  price?: number;

  @IsOptional()
  @IsUrl()
  url?: string;
}
