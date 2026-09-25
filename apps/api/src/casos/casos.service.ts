import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCasoDto } from './dto/create-caso.dto';
import { SetVariableDto } from './dto/set-variable.dto';

@Injectable()
export class CasosService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateCasoDto) {
    return this.prisma.caso.create({
      data: { ...dto, fechaExtincion: new Date(dto.fechaExtincion) },
    });
  }

  /** Casos individuales (sin lote) de un cliente, para el panel principal. */
  findIndividualesByCliente(clienteId: string) {
    return this.prisma.caso.findMany({
      where: { loteId: null, empleado: { clienteId } },
      include: { empleado: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const caso = await this.prisma.caso.findUnique({
      where: { id },
      include: {
        empleado: { include: { remuneracionesMensuales: { orderBy: { periodo: 'asc' } } } },
        variables: true,
        documentos: true,
        liquidaciones: { include: { rubros: { include: { rubro: true } } } },
        auditorias: { include: { hallazgos: { include: { rubro: true } } }, orderBy: { fecha: 'desc' } },
      },
    });
    if (!caso) throw new NotFoundException(`Caso ${id} no encontrado`);
    return caso;
  }

  async setVariable(casoId: string, dto: SetVariableDto) {
    await this.findOne(casoId);
    return this.prisma.variableCaso.upsert({
      where: { casoId_clave: { casoId, clave: dto.clave } },
      create: { casoId, ...dto },
      update: { valor: dto.valor, fuente: dto.fuente },
    });
  }

  /** Solo casos en borrador o en revisión: uno auditado o cerrado ya tiene un
   * resultado que alguien puede estar usando. Las relaciones no tienen borrado
   * en cascada, así que se borran los hijos primero. */
  async remove(id: string) {
    const caso = await this.prisma.caso.findUnique({ where: { id } });
    if (!caso) throw new NotFoundException(`Caso ${id} no encontrado`);
    if (caso.estado !== 'borrador' && caso.estado !== 'en_revision') {
      throw new BadRequestException(`No se puede eliminar un caso en estado "${caso.estado.replace('_', ' ')}"`);
    }

    await this.prisma.$transaction([
      this.prisma.hallazgo.deleteMany({ where: { auditoria: { casoId: id } } }),
      this.prisma.auditoria.deleteMany({ where: { casoId: id } }),
      this.prisma.liquidacionRubro.deleteMany({ where: { liquidacion: { casoId: id } } }),
      this.prisma.liquidacion.deleteMany({ where: { casoId: id } }),
      this.prisma.variableCaso.deleteMany({ where: { casoId: id } }),
      this.prisma.documento.deleteMany({ where: { casoId: id } }),
      this.prisma.informe.deleteMany({ where: { casoId: id } }),
      this.prisma.caso.delete({ where: { id } }),
    ]);
  }

  async actualizarEstado(id: string, estado: 'borrador' | 'en_revision' | 'auditado' | 'cerrado') {
    await this.findOne(id);
    return this.prisma.caso.update({ where: { id }, data: { estado } });
  }
}
