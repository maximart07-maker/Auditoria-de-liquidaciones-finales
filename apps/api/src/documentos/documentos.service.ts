import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDocumentoDto } from './create-documento.dto';

@Injectable()
export class DocumentosService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra el documento ya subido al almacenamiento de objetos y lo deja en estado
   * `pendiente` para que el worker de OCR (fuera del alcance de este scaffolding, ver
   * docs/arquitectura.md §2 — BullMQ + Textract/Document Intelligence) lo tome de la cola.
   */
  registrar(casoId: string, dto: CreateDocumentoDto) {
    return this.prisma.documento.create({
      data: { casoId, tipo: dto.tipo, archivoUrl: dto.archivoUrl, estadoProcesamiento: 'pendiente' },
    });
  }

  findAllByCaso(casoId: string) {
    return this.prisma.documento.findMany({ where: { casoId }, orderBy: { uploadedAt: 'desc' } });
  }
}
