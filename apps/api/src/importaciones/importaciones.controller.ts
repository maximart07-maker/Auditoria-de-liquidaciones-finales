import { BadRequestException, Body, Controller, Param, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ImportacionesService } from './importaciones.service';
import { ImportarReciboDto } from './dto/importar-recibo.dto';

const VEINTE_MB = 20 * 1024 * 1024;

@Controller('clientes/:clienteId/importaciones')
export class ImportacionesController {
  constructor(private readonly service: ImportacionesService) {}

  @Post('nomina')
  @UseInterceptors(
    FileInterceptor('archivo', {
      storage: memoryStorage(),
      limits: { fileSize: VEINTE_MB },
      fileFilter: (_req, file, callback) => {
        if (!file.originalname.toLowerCase().endsWith('.xlsx')) {
          callback(new BadRequestException('El archivo debe ser un .xlsx'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  importarNomina(@Param('clienteId') clienteId: string, @UploadedFile() archivo?: Express.Multer.File) {
    if (!archivo) throw new BadRequestException('Falta el archivo a importar (campo "archivo")');
    return this.service.importarNomina(clienteId, archivo.buffer);
  }

  @Post('recibo')
  @UseInterceptors(
    FileInterceptor('archivo', {
      storage: memoryStorage(),
      limits: { fileSize: VEINTE_MB },
      fileFilter: (_req, file, callback) => {
        if (!file.originalname.toLowerCase().endsWith('.pdf')) {
          callback(new BadRequestException('El archivo debe ser un .pdf'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  importarRecibo(
    @Param('clienteId') clienteId: string,
    @Body() dto: ImportarReciboDto,
    @UploadedFile() archivo?: Express.Multer.File,
  ) {
    if (!archivo) throw new BadRequestException('Falta el archivo a importar (campo "archivo")');
    return this.service.importarRecibo(clienteId, archivo.buffer, dto);
  }
}
