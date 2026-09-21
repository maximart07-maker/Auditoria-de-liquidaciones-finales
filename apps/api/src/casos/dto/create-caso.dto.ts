import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { TipoExtincion } from '@prisma/client';

export class CreateCasoDto {
  @IsString()
  empleadoId!: string;

  @IsOptional()
  @IsString()
  loteId?: string;

  @IsEnum(TipoExtincion)
  tipoExtincion!: TipoExtincion;

  @IsDateString()
  fechaExtincion!: string;
}
