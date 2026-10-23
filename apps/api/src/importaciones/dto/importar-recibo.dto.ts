import { IsDateString, IsIn } from 'class-validator';
import { TipoExtincion } from '@prisma/client';

const TIPOS_EXTINCION: TipoExtincion[] = [
  'despido_sin_causa',
  'despido_con_causa',
  'renuncia',
  'mutuo_acuerdo',
  'vencimiento_contrato',
  'fallecimiento',
];

/** El recibo no trae el motivo ni la fecha de extinción (no son datos de
 * nómina): los completa el auditor a mano junto con el archivo. */
export class ImportarReciboDto {
  @IsIn(TIPOS_EXTINCION)
  tipoExtincion!: TipoExtincion;

  @IsDateString()
  fechaExtincion!: string;
}
