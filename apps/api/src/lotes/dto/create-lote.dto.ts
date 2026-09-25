import { IsEnum, IsString, MinLength } from 'class-validator';
import { MotivoLote } from '@prisma/client';

export class CreateLoteDto {
  @IsString()
  clienteId!: string;

  @IsString()
  @MinLength(2)
  nombre!: string;

  @IsEnum(MotivoLote)
  motivo!: MotivoLote;
}
