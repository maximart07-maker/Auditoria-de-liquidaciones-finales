import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { LotesService } from './lotes.service';
import { CreateLoteDto } from './dto/create-lote.dto';

@Controller('lotes')
export class LotesController {
  constructor(private readonly lotesService: LotesService) {}

  @Post()
  create(@Body() dto: CreateLoteDto) {
    return this.lotesService.create(dto);
  }

  @Get()
  findAllByCliente(@Query('clienteId') clienteId: string) {
    return this.lotesService.findAllByCliente(clienteId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.lotesService.findOne(id);
  }
}
