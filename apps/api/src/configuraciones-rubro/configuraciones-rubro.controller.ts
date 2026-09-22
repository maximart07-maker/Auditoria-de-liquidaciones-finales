import { Body, Controller, Delete, Get, Param, Put } from '@nestjs/common';
import { ConfiguracionesRubroService } from './configuraciones-rubro.service';
import { UpsertConfiguracionRubroDto } from './dto/upsert-configuracion-rubro.dto';

@Controller('clientes/:clienteId/configuraciones-rubro')
export class ConfiguracionesRubroController {
  constructor(private readonly service: ConfiguracionesRubroService) {}

  @Get()
  listar(@Param('clienteId') clienteId: string) {
    return this.service.listar(clienteId);
  }

  @Put(':codigoRubro')
  upsert(
    @Param('clienteId') clienteId: string,
    @Param('codigoRubro') codigoRubro: string,
    @Body() dto: UpsertConfiguracionRubroDto,
  ) {
    return this.service.upsert(clienteId, codigoRubro, dto);
  }

  @Delete(':codigoRubro')
  eliminar(@Param('clienteId') clienteId: string, @Param('codigoRubro') codigoRubro: string) {
    return this.service.eliminar(clienteId, codigoRubro);
  }
}
