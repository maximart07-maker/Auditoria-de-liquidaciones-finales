import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertRemuneracionMensualDto } from './dto/upsert-remuneracion-mensual.dto';

@Injectable()
export class RemuneracionesMensualesService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(empleadoId: string) {
    await this.asegurarEmpleado(empleadoId);
    return this.prisma.remuneracionMensual.findMany({ where: { empleadoId }, orderBy: { periodo: 'asc' } });
  }

  async upsert(empleadoId: string, periodo: string, dto: UpsertRemuneracionMensualDto) {
    await this.asegurarEmpleado(empleadoId);
    const fechaPeriodo = new Date(periodo);

    return this.prisma.remuneracionMensual.upsert({
      where: { empleadoId_periodo: { empleadoId, periodo: fechaPeriodo } },
      create: {
        empleadoId,
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

  async eliminar(empleadoId: string, periodo: string) {
    await this.asegurarEmpleado(empleadoId);
    const fechaPeriodo = new Date(periodo);
    await this.prisma.remuneracionMensual.deleteMany({ where: { empleadoId, periodo: fechaPeriodo } });
  }

  private async asegurarEmpleado(empleadoId: string): Promise<void> {
    const empleado = await this.prisma.empleado.findUnique({ where: { id: empleadoId } });
    if (!empleado) throw new NotFoundException(`Empleado ${empleadoId} no encontrado`);
  }
}
