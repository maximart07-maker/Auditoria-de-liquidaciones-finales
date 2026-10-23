import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsIn, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

export class RubroMontoDto {
  @IsString()
  rubroCodigo!: string;

  @IsNumber()
  monto!: number;
}

export class CreateLiquidacionDto {
  @IsIn(['empresa'])
  origen!: 'empresa';

  @IsOptional()
  @IsString()
  fechaLiquidacion?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RubroMontoDto)
  rubros!: RubroMontoDto[];
}
