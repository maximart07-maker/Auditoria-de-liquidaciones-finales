import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { CasosService } from './casos.service';
import { CreateCasoDto } from './dto/create-caso.dto';
import { SetVariableDto } from './dto/set-variable.dto';

@Controller('casos')
export class CasosController {
  constructor(private readonly casosService: CasosService) {}

  @Post()
  create(@Body() dto: CreateCasoDto) {
    return this.casosService.create(dto);
  }

  @Get()
  findIndividualesByCliente(@Query('clienteId') clienteId: string) {
    return this.casosService.findIndividualesByCliente(clienteId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.casosService.findOne(id);
  }

  @Put(':id/variables')
  setVariable(@Param('id') id: string, @Body() dto: SetVariableDto) {
    return this.casosService.setVariable(id, dto);
  }
}
