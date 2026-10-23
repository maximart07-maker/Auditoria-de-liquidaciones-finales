import { Body, Controller, Param, Post } from '@nestjs/common';
import { LiquidacionesService } from './liquidaciones.service';
import { CreateLiquidacionDto } from './dto/create-liquidacion.dto';

@Controller('casos/:casoId/liquidaciones')
export class LiquidacionesController {
  constructor(private readonly liquidacionesService: LiquidacionesService) {}

  @Post()
  crearLiquidacionEmpresa(@Param('casoId') casoId: string, @Body() dto: CreateLiquidacionDto) {
    return this.liquidacionesService.crearLiquidacionEmpresa(casoId, dto);
  }
}
