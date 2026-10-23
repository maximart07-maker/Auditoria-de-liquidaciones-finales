import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLiquidacionDto } from './dto/create-liquidacion.dto';

@Injectable()
export class LiquidacionesService {
  constructor(private readonly prisma: PrismaService) {}

  async crearLiquidacionEmpresa(casoId: string, dto: CreateLiquidacionDto) {
    const caso = await this.prisma.caso.findUnique({ where: { id: casoId } });
    if (!caso) throw new NotFoundException(`Caso ${casoId} no encontrado`);

    const rubros = await this.prisma.rubro.findMany({
      where: { codigo: { in: dto.rubros.map((r) => r.rubroCodigo) } },
    });
    const rubroIdPorCodigo = new Map(rubros.map((r) => [r.codigo, r.id]));
    const codigosFaltantes = dto.rubros.map((r) => r.rubroCodigo).filter((c) => !rubroIdPorCodigo.has(c));
    if (codigosFaltantes.length > 0) {
      throw new BadRequestException(`Rubros no encontrados en el catálogo: ${codigosFaltantes.join(', ')}`);
    }

    // Cualquier liquidación previa de la empresa para este caso queda reemplazada
    // (se conserva el historial, ver docs/modelo-datos.md).
    await this.prisma.liquidacion.updateMany({
      where: { casoId, origen: 'empresa', estado: 'vigente' },
      data: { estado: 'reemplazada' },
    });

    const version = (await this.prisma.liquidacion.count({ where: { casoId, origen: 'empresa' } })) + 1;

    return this.prisma.liquidacion.create({
      data: {
        casoId,
        origen: 'empresa',
        version,
        fechaLiquidacion: dto.fechaLiquidacion ? new Date(dto.fechaLiquidacion) : undefined,
        rubros: {
          create: dto.rubros.map((r) => ({
            rubroId: rubroIdPorCodigo.get(r.rubroCodigo)!,
            monto: r.monto,
          })),
        },
      },
      include: { rubros: { include: { rubro: true } } },
    });
  }

  findVigenteByCaso(casoId: string, origen: 'empresa' | 'sistema') {
    return this.prisma.liquidacion.findFirst({
      where: { casoId, origen, estado: 'vigente' },
      include: { rubros: { include: { rubro: true } } },
      orderBy: { version: 'desc' },
    });
  }
}
