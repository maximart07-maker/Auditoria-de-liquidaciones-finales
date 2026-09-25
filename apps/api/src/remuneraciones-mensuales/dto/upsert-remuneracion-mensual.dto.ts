import { IsBoolean, IsIn, IsNumber, IsObject, IsOptional } from 'class-validator';

export class UpsertRemuneracionMensualDto {
  /** Suma de conceptos remunerativos del mes (básico, horas extra, comisiones,
   * premios habituales, etc.) — sin lo no remunerativo. */
  @IsNumber()
  conceptosRemunerativos!: number;

  /** false si el mes está distorsionado por algo excepcional (retroactivo,
   * liquidación de vacaciones) y no debe competir por ser la "mejor" remuneración. */
  @IsOptional()
  @IsBoolean()
  esNormalYHabitual?: boolean;

  /** Desglose opcional (básico, horas extra, comisiones, etc.) para trazabilidad. */
  @IsOptional()
  @IsObject()
  detalle?: Record<string, number>;

  @IsOptional()
  @IsIn(['manual', 'ocr', 'importado'])
  fuente?: 'manual' | 'ocr' | 'importado';
}
