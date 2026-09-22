import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertRemuneracionMensualDto } from './dto/upsert-remuneracion-mensual.dto';

@Injectable()
export class RemuneracionesMensualesService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(casoId: string) {
    await this.asegurarCaso(casoId);
    return this.prisma.remuneracionMensual.findMany({ where: { casoId }, orderBy: { periodo: 'asc' } });
  }

  async upsert(casoId: string, periodo: string, dto: UpsertRemuneracionMensualDto) {
    await this.asegurarCaso(casoId);
    const fechaPeriodo = new Date(periodo);

    return this.prisma.remuneracionMensual.upsert({
      where: { casoId_periodo: { casoId, periodo: fechaPeriodo } },
      create: {
        casoId,
        periodo: fechaPeriodo,
        conceptosRemunerativos: dto.conceptosRemunerativos,
        esNormalYHabitual: dto.esNormalYHabitual ?? true,
        detalle: dto.detalle,
        fuente: dto.fuente ?? 'manual',
      },
      update: {
        conceptosRemunerativos: dto.conceptosRemunerativos,
        esNormalYHabitual: dto.esNormalYHabitual ?? true,
        detalle: (dto.detalle as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        fuente: dto.fuente ?? 'manual',
      },
    });
  }

  async eliminar(casoId: string, periodo: string) {
    await this.asegurarCaso(casoId);
    const fechaPeriodo = new Date(periodo);
    await this.prisma.remuneracionMensual.deleteMany({ where: { casoId, periodo: fechaPeriodo } });
  }

  private async asegurarCaso(casoId: string): Promise<void> {
    const caso = await this.prisma.caso.findUnique({ where: { id: casoId } });
    if (!caso) throw new NotFoundException(`Caso ${casoId} no encontrado`);
  }
}
