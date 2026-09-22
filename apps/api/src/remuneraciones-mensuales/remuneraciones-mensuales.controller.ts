import { Body, Controller, Delete, Get, Param, Put } from '@nestjs/common';
import { RemuneracionesMensualesService } from './remuneraciones-mensuales.service';
import { UpsertRemuneracionMensualDto } from './dto/upsert-remuneracion-mensual.dto';

@Controller('empleados/:empleadoId/remuneraciones-mensuales')
export class RemuneracionesMensualesController {
  constructor(private readonly service: RemuneracionesMensualesService) {}

  @Get()
  listar(@Param('empleadoId') empleadoId: string) {
    return this.service.listar(empleadoId);
  }

  @Put(':periodo')
  upsert(
    @Param('empleadoId') empleadoId: string,
    @Param('periodo') periodo: string,
    @Body() dto: UpsertRemuneracionMensualDto,
  ) {
    return this.service.upsert(empleadoId, periodo, dto);
  }

  @Delete(':periodo')
  eliminar(@Param('empleadoId') empleadoId: string, @Param('periodo') periodo: string) {
    return this.service.eliminar(empleadoId, periodo);
  }
}
