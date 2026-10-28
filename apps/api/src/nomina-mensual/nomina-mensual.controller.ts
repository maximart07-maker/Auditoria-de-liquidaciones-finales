import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { NominaMensualService } from './nomina-mensual.service';
import { generarCsvControlLeyes, generarPdfControlLeyes, nombreArchivoInforme } from './informe-control-leyes';

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
    return this.service.controlDeLeyes(clienteId, validarPeriodo(periodo));
  }

  /** Informe del panel y del cruce para descargar: `formato` pdf o csv. */
  @Get('control-de-leyes/informe.:formato')
  async informe(
    @Param('clienteId') clienteId: string,
    @Param('formato') formato: string,
    @Query('periodo') periodo: string | undefined,
    @Res() res: Response,
  ) {
    if (formato !== 'pdf' && formato !== 'csv') throw new BadRequestException('El formato debe ser pdf o csv');
    const datos = await this.service.informeControlDeLeyes(clienteId, validarPeriodo(periodo));
    const contenido = formato === 'pdf' ? await generarPdfControlLeyes(datos) : generarCsvControlLeyes(datos);
    res.set({
      'Content-Type': formato === 'pdf' ? 'application/pdf' : 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${nombreArchivoInforme(datos, formato)}"`,
      'Content-Length': String(contenido.length),
    });
    res.end(contenido);
  }
}

function validarPeriodo(periodo: string | undefined): string {
  if (!periodo || !/^\d{4}-\d{2}$/.test(periodo)) {
    throw new BadRequestException('Indicá el período en formato AAAA-MM (parámetro "periodo")');
  }
  return periodo;
}
