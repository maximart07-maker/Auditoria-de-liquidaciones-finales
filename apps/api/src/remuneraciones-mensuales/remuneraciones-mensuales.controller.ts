import { Body, Controller, Delete, Get, Param, Put } from '@nestjs/common';
import { RemuneracionesMensualesService } from './remuneraciones-mensuales.service';
import { UpsertRemuneracionMensualDto } from './dto/upsert-remuneracion-mensual.dto';

@Controller('casos/:casoId/remuneraciones-mensuales')
export class RemuneracionesMensualesController {
  constructor(private readonly service: RemuneracionesMensualesService) {}

  @Get()
  listar(@Param('casoId') casoId: string) {
    return this.service.listar(casoId);
  }

  @Put(':periodo')
  upsert(
    @Param('casoId') casoId: string,
    @Param('periodo') periodo: string,
    @Body() dto: UpsertRemuneracionMensualDto,
  ) {
    return this.service.upsert(casoId, periodo, dto);
  }

  @Delete(':periodo')
  eliminar(@Param('casoId') casoId: string, @Param('periodo') periodo: string) {
    return this.service.eliminar(casoId, periodo);
  }
}
