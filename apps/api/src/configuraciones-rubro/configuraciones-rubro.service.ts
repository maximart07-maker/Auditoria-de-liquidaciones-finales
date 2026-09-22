import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { validarTopeIndemnizatorio, TopeIndemnizatorioInvalidoError } from '@audit/motor-calculo';
import { Prisma, Rubro } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertConfiguracionRubroDto } from './dto/upsert-configuracion-rubro.dto';

/**
 * Claves de `parametros` habilitadas por rubro legal. Cualquier otra clave, o
 * cualquier intento de tocar un rubro legal que no esté en este mapa, se rechaza.
 * IND_ANTIGUEDAD solo admite el tope indemnizatorio propio del convenio del
 * cliente — el piso del 67% de la MRMNH (doctrina "Vizzoti") lo sigue aplicando
 * siempre el motor de cálculo, sin que este parámetro pueda relajarlo.
 */
const PARAMETROS_PERMITIDOS_POR_RUBRO: Record<string, string[]> = {
  IND_ANTIGUEDAD: ['topeIndemnizatorio'],
};

@Injectable()
export class ConfiguracionesRubroService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(clienteId: string) {
    await this.asegurarCliente(clienteId);

    const [rubros, configuraciones] = await Promise.all([
      this.prisma.rubro.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } }),
      this.prisma.configuracionRubroCliente.findMany({ where: { clienteId } }),
    ]);
    const configPorRubroId = new Map(configuraciones.map((c) => [c.rubroId, c]));

    return rubros.map((rubro) => {
      const config = configPorRubroId.get(rubro.id);
      return {
        rubro: { id: rubro.id, codigo: rubro.codigo, nombre: rubro.nombre, baseLegal: rubro.baseLegal, esLegal: rubro.esLegal },
        tipo: config?.tipo ?? rubro.tipoDefault,
        activo: config?.activo ?? true,
        valorFijo: config?.valorFijo ?? null,
        parametros: (config?.parametros as Record<string, number> | null) ?? null,
        personalizado: Boolean(config),
      };
    });
  }

  async upsert(clienteId: string, codigoRubro: string, dto: UpsertConfiguracionRubroDto) {
    await this.asegurarCliente(clienteId);

    let rubro = await this.prisma.rubro.findUnique({ where: { codigo: codigoRubro } });
    if (!rubro) {
      if (dto.tipo !== 'variable') {
        throw new BadRequestException(
          `El rubro "${codigoRubro}" no existe en el catálogo; solo se pueden dar de alta conceptos nuevos de tipo "variable"`,
        );
      }
      rubro = await this.prisma.rubro.create({
        data: {
          codigo: codigoRubro,
          nombre: dto.nombre ?? codigoRubro,
          baseLegal: dto.baseLegal,
          esLegal: false,
          tipoDefault: 'variable',
        },
      });
    }

    this.validarContraLegislacion(rubro, dto);

    return this.prisma.configuracionRubroCliente.upsert({
      where: { clienteId_rubroId: { clienteId, rubroId: rubro.id } },
      create: {
        clienteId,
        rubroId: rubro.id,
        tipo: dto.tipo,
        activo: dto.activo,
        valorFijo: dto.valorFijo,
        parametros: dto.parametros,
      },
      update: {
        tipo: dto.tipo,
        activo: dto.activo,
        valorFijo: dto.valorFijo,
        parametros: dto.parametros ?? Prisma.JsonNull,
      },
      include: { rubro: true },
    });
  }

  async eliminar(clienteId: string, codigoRubro: string) {
    const rubro = await this.prisma.rubro.findUnique({ where: { codigo: codigoRubro } });
    if (!rubro) return;
    await this.prisma.configuracionRubroCliente.deleteMany({ where: { clienteId, rubroId: rubro.id } });
  }

  /**
   * Garantiza que ningún cliente pueda, vía configuración, esquivar lo que
   * establece la legislación laboral argentina para un rubro legal: no se puede
   * desactivar, no se puede pasar a "variable", no admite monto manual, y solo
   * acepta los parámetros normativos explícitamente permitidos para ese rubro.
   */
  private validarContraLegislacion(rubro: Rubro, dto: UpsertConfiguracionRubroDto): void {
    if (!rubro.esLegal) return;

    if (dto.tipo !== 'fijo') {
      throw new BadRequestException(
        `"${rubro.nombre}" está establecido por la legislación laboral (${rubro.baseLegal ?? 'LCT'}) y no puede configurarse como concepto variable.`,
      );
    }
    if (!dto.activo) {
      throw new BadRequestException(
        `"${rubro.nombre}" es de aplicación obligatoria cuando corresponde legalmente (${rubro.baseLegal ?? 'LCT'}) y no puede desactivarse por cliente.`,
      );
    }
    if (dto.valorFijo !== undefined) {
      throw new BadRequestException(
        `"${rubro.nombre}" siempre lo determina el motor de cálculo (no admite un monto fijo manual), para garantizar el piso legal.`,
      );
    }
    if (dto.parametros) {
      const clavesPermitidas = PARAMETROS_PERMITIDOS_POR_RUBRO[rubro.codigo] ?? [];
      const clavesInvalidas = Object.keys(dto.parametros).filter((clave) => !clavesPermitidas.includes(clave));
      if (clavesInvalidas.length > 0) {
        throw new BadRequestException(`Parámetro(s) no permitido(s) para "${rubro.nombre}": ${clavesInvalidas.join(', ')}`);
      }

      if (rubro.codigo === 'IND_ANTIGUEDAD' && dto.parametros.topeIndemnizatorio !== undefined) {
        try {
          validarTopeIndemnizatorio(dto.parametros.topeIndemnizatorio);
        } catch (error) {
          if (error instanceof TopeIndemnizatorioInvalidoError) throw new BadRequestException(error.message);
          throw error;
        }
      }
    }
  }

  private async asegurarCliente(clienteId: string): Promise<void> {
    const cliente = await this.prisma.cliente.findUnique({ where: { id: clienteId } });
    if (!cliente) throw new NotFoundException(`Cliente ${clienteId} no encontrado`);
  }
}
