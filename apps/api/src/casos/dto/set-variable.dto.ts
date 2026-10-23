import { IsIn, IsString } from 'class-validator';

export class SetVariableDto {
  @IsString()
  clave!: string;

  @IsString()
  valor!: string;

  @IsIn(['manual', 'ocr', 'importado'])
  fuente!: 'manual' | 'ocr' | 'importado';
}
