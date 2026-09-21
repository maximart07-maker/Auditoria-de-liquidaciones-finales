import { IsDateString, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateEmpleadoDto {
  @IsString()
  clienteId!: string;

  @IsString()
  @MinLength(2)
  nombre!: string;

  @IsString()
  cuil!: string;

  @IsDateString()
  fechaIngreso!: string;

  @IsOptional()
  @IsString()
  categoria?: string;

  @IsOptional()
  @IsString()
  convenioColectivo?: string;

  @IsOptional()
  @IsString()
  provincia?: string;

  @IsOptional()
  @IsNumber()
  remuneracionBase?: number;
}
