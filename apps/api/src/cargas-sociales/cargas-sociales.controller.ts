import { Body, Controller, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { CargasSocialesService } from './cargas-sociales.service';
import { UpsertCargasSocialesDto } from './dto/upsert-cargas-sociales.dto';
import { CalcularCargasSocialesDto } from './dto/calcular-cargas-sociales.dto';

@Controller('clientes/:clienteId/cargas-sociales')
export class CargasSocialesController {
  constructor(private readonly service: CargasSocialesService) {}

  @Get()
  obtener(@Param('clienteId') clienteId: string) {
    return this.service.obtener(clienteId);
  }

  @Put()
  guardar(@Param('clienteId') clienteId: string, @Body() dto: UpsertCargasSocialesDto) {
    return this.service.guardar(clienteId, dto);
  }

  @Post('calculo')
  @HttpCode(200)
  calcular(@Param('clienteId') clienteId: string, @Body() dto: CalcularCargasSocialesDto) {
    return this.service.calcular(clienteId, dto);
  }
}
