import { IsBoolean, IsInt, IsNumber, Min } from 'class-validator';

export class CalcularCargasSocialesDto {
  /** Sueldo bruto remunerativo por empleado. */
  @IsNumber()
  @Min(0)
  sueldoBruto!: number;

  @IsInt()
  @Min(1)
  cantidadEmpleados!: number;

  @IsBoolean()
  incluyeSAC!: boolean;
}
