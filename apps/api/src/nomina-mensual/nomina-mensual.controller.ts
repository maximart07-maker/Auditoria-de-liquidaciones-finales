import { BadRequestException, Controller, Get, Param, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { NominaMensualService } from './nomina-mensual.service';

const VEINTE_MB = 20 * 1024 * 1024;

@Controller('clientes/:clienteId/nomina-mensual')
export class NominaMensualController {
  constructor(private readonly service: NominaMensualService) {}

  @Get('reportes-f931')
  listarReportes(@Param('clienteId') clienteId: string) {
    return this.service.listarReportes(clienteId);
  }

  @Post('reportes-f931')
  @UseInterceptors(
    FileInterceptor('archivo', {
      storage: memoryStorage(),
      limits: { fileSize: VEINTE_MB },
      fileFilter: (_req, file, callback) => {
        const nombre = file.originalname.toLowerCase();
        if (!nombre.endsWith('.csv') && !nombre.endsWith('.txt')) {
          callback(new BadRequestException('El reporte debe ser un .csv separado por punto y coma'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  importarReporte(@Param('clienteId') clienteId: string, @UploadedFile() archivo?: Express.Multer.File) {
    if (!archivo) throw new BadRequestException('Falta el archivo a importar (campo "archivo")');
    return this.service.importarReporte(clienteId, archivo.originalname, archivo.buffer);
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
