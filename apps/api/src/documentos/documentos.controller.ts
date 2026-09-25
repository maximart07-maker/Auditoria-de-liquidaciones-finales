import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { DocumentosService } from './documentos.service';
import { CreateDocumentoDto } from './create-documento.dto';

@Controller('casos/:casoId/documentos')
export class DocumentosController {
  constructor(private readonly documentosService: DocumentosService) {}

  @Post()
  registrar(@Param('casoId') casoId: string, @Body() dto: CreateDocumentoDto) {
    return this.documentosService.registrar(casoId, dto);
  }

  @Get()
  findAllByCaso(@Param('casoId') casoId: string) {
    return this.documentosService.findAllByCaso(casoId);
  }
}
