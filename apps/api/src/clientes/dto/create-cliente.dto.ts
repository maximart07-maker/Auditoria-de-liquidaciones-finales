import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateClienteDto {
  @IsString()
  @MinLength(2)
  razonSocial!: string;

  @IsString()
  @MinLength(11)
  cuit!: string;

  @IsOptional()
  @IsString()
  industria?: string;

  @IsOptional()
  @IsEmail()
  contactoEmail?: string;
}
