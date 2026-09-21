import { IsIn, IsString } from 'class-validator';

export class CreateDocumentoDto {
  @IsIn(['recibo_sueldo', 'telegrama', 'liquidacion_final', 'cct', 'otro'])
  tipo!: 'recibo_sueldo' | 'telegrama' | 'liquidacion_final' | 'cct' | 'otro';

  /** URL ya subida al almacenamiento de objetos (S3/MinIO) vía presigned URL desde el frontend. */
  @IsString()
  archivoUrl!: string;
}
