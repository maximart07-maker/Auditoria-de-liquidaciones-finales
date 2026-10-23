import { IsBoolean, IsIn, IsNumber, IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class UpsertConfiguracionRubroDto {
  @IsIn(['fijo', 'variable'])
  tipo!: 'fijo' | 'variable';

  @IsBoolean()
  activo!: boolean;

  /** Solo para conceptos variables (esLegal=false en Rubro): monto fijo negociado. */
  @IsOptional()
  @IsNumber()
  valorFijo?: number;

  /**
   * Parámetros normativos del concepto. Para rubros legales, las claves permitidas
   * están acotadas por rubro (p.ej. IND_ANTIGUEDAD solo admite "topeIndemnizatorio")
   * — ver ConfiguracionRubroClienteService.PARAMETROS_PERMITIDOS_POR_RUBRO.
   */
  @IsOptional()
  @IsObject()
  parametros?: Record<string, number>;

  /** Solo se usan si el código de rubro todavía no existe en el catálogo (alta de un concepto variable nuevo). */
  @IsOptional()
  @IsString()
  @MinLength(2)
  nombre?: string;

  @IsOptional()
  @IsString()
  baseLegal?: string;
}
