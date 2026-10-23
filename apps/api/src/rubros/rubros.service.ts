import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RubrosService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.rubro.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } });
  }
}
