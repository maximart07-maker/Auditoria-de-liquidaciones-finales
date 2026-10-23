import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  calcularCargasSociales,
  ConfiguracionCargasSociales,
  ConfiguracionCargasSocialesInvalidaError,
  validarConfiguracionCargasSociales,
} from '@audit/motor-calculo';
import { ConfiguracionCargasSocialesCliente } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertCargasSocialesDto } from './dto/upsert-cargas-sociales.dto';
import { CalcularCargasSocialesDto } from './dto/calcular-cargas-sociales.dto';

/** Valores iniciales que se muestran mientras el cliente no tiene configuración guardada. */
const CONFIGURACION_POR_DEFECTO: ConfiguracionCargasSociales = {
  tipoEmpleador: 'pyme',
  regimenDiferencial: 'comun',
  adicionalDiferencialPorcentaje: 0,
  aplicaFAL: false,
  artPorcentaje: 0,
  artCuotaFija: 0,
  scvoPorEmpleado: 0,
  regimenDetraccion: 'general',
  montoDetraccionPersonalizado: null,
  horasSemanalesJornadaParcial: null,
};

@Injectable()
export class CargasSocialesService {
  constructor(private readonly prisma: PrismaService) {}

  async obtener(clienteId: string) {
    await this.asegurarCliente(clienteId);
    const registro = await this.prisma.configuracionCargasSocialesCliente.findUnique({ where: { clienteId } });
    return {
      configurado: Boolean(registro),
      configuracion: registro ? this.aDominio(registro) : CONFIGURACION_POR_DEFECTO,
    };
  }

  async guardar(clienteId: string, dto: UpsertCargasSocialesDto) {
    await this.asegurarCliente(clienteId);
    const configuracion: ConfiguracionCargasSociales = {
      ...dto,
      montoDetraccionPersonalizado: dto.montoDetraccionPersonalizado ?? null,
      horasSemanalesJornadaParcial: dto.horasSemanalesJornadaParcial ?? null,
    };
    this.conErroresDeMotor(() => validarConfiguracionCargasSociales(configuracion));

    const { aplicaFAL, ...resto } = configuracion;
    const datos = { ...resto, aplicaFal: aplicaFAL };
    const registro = await this.prisma.configuracionCargasSocialesCliente.upsert({
      where: { clienteId },
      create: { clienteId, ...datos },
      update: datos,
    });
    return { configurado: true, configuracion: this.aDominio(registro) };
  }

  async calcular(clienteId: string, dto: CalcularCargasSocialesDto) {
    const { configurado, configuracion } = await this.obtener(clienteId);
    if (!configurado) {
      throw new BadRequestException('El cliente todavía no tiene configuradas sus cargas sociales.');
    }
    return this.conErroresDeMotor(() => calcularCargasSociales(configuracion, dto));
  }

  private aDominio(r: ConfiguracionCargasSocialesCliente): ConfiguracionCargasSociales {
    return {
      tipoEmpleador: r.tipoEmpleador,
      regimenDiferencial: r.regimenDiferencial,
      adicionalDiferencialPorcentaje: Number(r.adicionalDiferencialPorcentaje),
      aplicaFAL: r.aplicaFal,
      artPorcentaje: Number(r.artPorcentaje),
      artCuotaFija: Number(r.artCuotaFija),
      scvoPorEmpleado: Number(r.scvoPorEmpleado),
      regimenDetraccion: r.regimenDetraccion,
      montoDetraccionPersonalizado: r.montoDetraccionPersonalizado === null ? null : Number(r.montoDetraccionPersonalizado),
      horasSemanalesJornadaParcial: r.horasSemanalesJornadaParcial === null ? null : Number(r.horasSemanalesJornadaParcial),
    };
  }

  private conErroresDeMotor<T>(fn: () => T): T {
    try {
      return fn();
    } catch (error) {
      if (error instanceof ConfiguracionCargasSocialesInvalidaError) throw new BadRequestException(error.message);
      throw error;
    }
  }

  private async asegurarCliente(clienteId: string): Promise<void> {
    const cliente = await this.prisma.cliente.findUnique({ where: { id: clienteId } });
    if (!cliente) throw new NotFoundException(`Cliente ${clienteId} no encontrado`);
  }
}
