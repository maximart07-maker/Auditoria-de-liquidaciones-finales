import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLoteDto } from './dto/create-lote.dto';

@Injectable()
export class LotesService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateLoteDto) {
    return this.prisma.lote.create({ data: dto });
  }

  findAllByCliente(clienteId: string) {
    return this.prisma.lote.findMany({
      where: { clienteId },
      include: { _count: { select: { casos: true } } },
      orderBy: { fechaCreacion: 'desc' },
    });
  }

  async findOne(id: string) {
    const lote = await this.prisma.lote.findUnique({
      where: { id },
      include: { casos: { include: { empleado: true } } },
    });
    if (!lote) throw new NotFoundException(`Lote ${id} no encontrado`);
    return lote;
  }
}
