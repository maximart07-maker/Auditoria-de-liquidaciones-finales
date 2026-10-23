import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmpleadoDto } from './dto/create-empleado.dto';
import { UpdateEmpleadoDto } from './dto/update-empleado.dto';

@Injectable()
export class EmpleadosService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateEmpleadoDto) {
    return this.prisma.empleado.create({
      data: { ...dto, fechaIngreso: new Date(dto.fechaIngreso) },
    });
  }

  findAllByCliente(clienteId: string) {
    return this.prisma.empleado.findMany({ where: { clienteId }, orderBy: { nombre: 'asc' } });
  }

  async findOne(id: string) {
    const empleado = await this.prisma.empleado.findUnique({ where: { id } });
    if (!empleado) throw new NotFoundException(`Empleado ${id} no encontrado`);
    return empleado;
  }

  async update(id: string, dto: UpdateEmpleadoDto) {
    await this.findOne(id);
    const { fechaIngreso, ...resto } = dto;
    return this.prisma.empleado.update({
      where: { id },
      data: { ...resto, ...(fechaIngreso ? { fechaIngreso: new Date(fechaIngreso) } : {}) },
    });
  }
}
