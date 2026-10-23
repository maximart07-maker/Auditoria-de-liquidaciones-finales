import { IsBoolean, IsIn, IsNumber, IsOptional } from 'class-validator';

/** Los rangos y combinaciones válidas los controla `validarConfiguracionCargasSociales` (motor-calculo). */
export class UpsertCargasSocialesDto {
  @IsIn(['pyme', 'gran_empresa'])
  tipoEmpleador!: 'pyme' | 'gran_empresa';

  @IsIn(['comun', 'choferes', 'construccion', 'docentes', 'insalubres', 'manual'])
  regimenDiferencial!: 'comun' | 'choferes' | 'construccion' | 'docentes' | 'insalubres' | 'manual';

  @IsNumber()
  adicionalDiferencialPorcentaje!: number;

  @IsBoolean()
  aplicaFAL!: boolean;

  @IsNumber()
  artPorcentaje!: number;

  @IsNumber()
  artCuotaFija!: number;

  @IsNumber()
  scvoPorEmpleado!: number;

  @IsIn(['general', 'incrementado', 'sin_detraccion'])
  regimenDetraccion!: 'general' | 'incrementado' | 'sin_detraccion';

  /** Null/omitido = monto de la Ley 27.541. */
  @IsOptional()
  @IsNumber()
  montoDetraccionPersonalizado?: number | null;

  /** Null/omitido = jornada completa. */
  @IsOptional()
  @IsNumber()
  horasSemanalesJornadaParcial?: number | null;
}
