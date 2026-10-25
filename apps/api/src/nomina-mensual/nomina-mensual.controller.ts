import { BadRequestException, Controller, Get, Param, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { NominaMensualService } from './nomina-mensual.service';

const VEINTE_MB = 20 * 1024 * 1024;

const soloCsv = {
  storage: memoryStorage(),
  limits: { fileSize: VEINTE_MB },
  fileFilter: (_req: unknown, file: Express.Multer.File, callback: (error: Error | null, aceptar: boolean) => void) => {
    const nombre = file.originalname.toLowerCase();
    if (!nombre.endsWith('.csv') && !nombre.endsWith('.txt')) {
      callback(new BadRequestException('El archivo debe ser un .csv separado por punto y coma'), false);
      return;
    }
    callback(null, true);
  },
};

@Controller('clientes/:clienteId/nomina-mensual')
export class NominaMensualController {
  constructor(private readonly service: NominaMensualService) {}

  @Get('reportes-f931')
  listarReportes(@Param('clienteId') clienteId: string) {
    return this.service.listarReportes(clienteId);
  }

  @Post('reportes-f931')
  @UseInterceptors(FileInterceptor('archivo', soloCsv))
  importarReporte(@Param('clienteId') clienteId: string, @UploadedFile() archivo?: Express.Multer.File) {
    if (!archivo) throw new BadRequestException('Falta el archivo a importar (campo "archivo")');
    return this.service.importarReporte(clienteId, archivo.originalname, archivo.buffer);
  }

  @Get('nominas-ddjj')
  listarNominasDDJJ(@Param('clienteId') clienteId: string) {
    return this.service.listarNominasDDJJ(clienteId);
  }

  /** Nómina descargada de Declaración en Línea, para cruzar por CUIL con el reporte del mismo período. */
  @Post('nominas-ddjj')
  @UseInterceptors(FileInterceptor('archivo', soloCsv))
  importarNominaDDJJ(@Param('clienteId') clienteId: string, @UploadedFile() archivo?: Express.Multer.File) {
    if (!archivo) throw new BadRequestException('Falta el archivo a importar (campo "archivo")');
    return this.service.importarNominaDDJJ(clienteId, archivo.originalname, archivo.buffer);
  }

  /** `periodo` en formato AAAA-MM. */
  @Get('control-de-leyes')
  controlDeLeyes(@Param('clienteId') clienteId: string, @Query('periodo') periodo?: string) {
    if (!periodo || !/^\d{4}-\d{2}$/.test(periodo)) {
      throw new BadRequestException('Indicá el período en formato AAAA-MM (parámetro "periodo")');
    }
    return this.service.controlDeLeyes(clienteId, periodo);
  }
}
