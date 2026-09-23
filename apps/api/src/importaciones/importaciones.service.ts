import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FilaNominaImportada, parsearNomina } from './nomina-importada.parser';
import { ImportarReciboDto } from './dto/importar-recibo.dto';
import { parsearReciboLiquidacion, rubroParaConcepto } from './recibo-liquidacion.parser';
import { normalizarCodigoConcepto, parsearConceptosCliente } from './conceptos-cliente.parser';

interface MesAgregado {
  conceptosRemunerativos: number;
  conceptosNoRemunerativos: number;
  /** Base del SAC proporcional (arts. 121-123 LCT) — ver
   * ImportacionesService.remuneracionDevengadaSacDeRecibo, misma idea acá pero
   * fila por fila de nómina en vez de conceptos de un recibo. */
  remuneracionDevengadaSac: number;
  detalleConceptos: { concepto: string; monto: number; tipo: string }[];
  /** true si algún renglón del mes viene de un proceso de "ajuste" (retroactivo) —
   * ver ResumenImportacion.esNormalYHabitual más abajo. */
  tieneAjuste: boolean;
}

interface DatosEmpleado {
  nombre: string;
  fechaIngreso: Date;
  categoria: string | null;
  meses: Map<string, MesAgregado>;
}

export interface ResumenImportacion {
  filasProcesadas: number;
  empleadosDetectados: number;
  empleadosCreados: number;
  empleadosActualizados: number;
  mesesImportados: number;
  errores: string[];
}

export interface ResumenImportacionRecibo {
  empresaDelRecibo: string | null;
  cuitDelRecibo: string | null;
  empleado: { id: string; nombre: string; cuil: string; creado: boolean };
  casoId: string;
  remuneracionMensual: { periodo: string; conceptosRemunerativos: number; esNormalYHabitual: boolean };
  rubrosDeclarados: { rubroCodigo: string; concepto: string; monto: number }[];
  /** Conceptos del recibo que no matchearon ningún rubro del motor (informativo). */
  conceptosSinMapear: { concepto: string; monto: number }[];
  /** Rubros legales que el recibo no trae (p.ej. indemnización, preaviso,
   * integración) — quedan declarados en $0, lo que la auditoría marca como
   * diferencia del 100% contra lo calculado si el sistema los calcula. */
  rubrosLegalesNoEncontradosEnElRecibo: string[];
  /** true si `conceptosRemunerativos` se calculó con el catálogo propio del
   * cliente (ConceptoCliente.baseIndemnizacion); false si el cliente no tiene
   * catálogo cargado y se usó el total "Remunerativo" que imprime el recibo
   * (menos preciso: puede incluir conceptos remunerativos que la doctrina
   * excluye de la base del art. 245, como el SAC). */
  baseCalculadaConCatalogo: boolean;
  /** Días de vacaciones de períodos anteriores (art. 156 LCT) que se
   * autocompletaron desde la unidad del concepto "Vac No Gozadas Anterior"
   * del recibo, como `VariableCaso` `diasVacacionesPendientesPeriodosAnteriores`
   * (fuente "importado"). `null` si el recibo no trae ese concepto o no
   * informa la unidad — en ese caso hay que cargarlo a mano. */
  diasVacacionesPendientesPeriodosAnteriores: number | null;
}

export interface ResumenImportacionConceptos {
  clienteId: string;
  conceptosProcesados: number;
  conceptosCreados: number;
  conceptosActualizados: number;
}

@Injectable()
export class ImportacionesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Importa el catálogo propio del cliente para los códigos de concepto de su
   * sistema de nómina (Código, Descripción, Tipo, Característica, Base
   * Indemnización — ver docs/motor-calculo.md §2.4). Los importadores de
   * nómina y de recibo lo usan para saber, código por código, qué computa
   * para la base del art. 245 LCT (`baseIndemnizacion`), en vez de asumirlo
   * por el tipo remunerativo/no remunerativo. Idempotente por `[clienteId, codigo]`.
   */
  async importarConceptos(clienteId: string, buffer: Buffer): Promise<ResumenImportacionConceptos> {
    await this.asegurarCliente(clienteId);
    const conceptos = await parsearConceptosCliente(buffer);

    const existentes = await this.prisma.conceptoCliente.findMany({
      where: { clienteId, codigo: { in: conceptos.map((c) => c.codigo) } },
      select: { codigo: true },
    });
    const codigosExistentes = new Set(existentes.map((c) => c.codigo));

    let conceptosCreados = 0;
    let conceptosActualizados = 0;
    for (const concepto of conceptos) {
      await this.prisma.conceptoCliente.upsert({
        where: { clienteId_codigo: { clienteId, codigo: concepto.codigo } },
        create: { clienteId, ...concepto },
        update: { ...concepto },
      });
      if (codigosExistentes.has(concepto.codigo)) conceptosActualizados++;
      else conceptosCreados++;
    }

    return {
      clienteId,
      conceptosProcesados: conceptos.length,
      conceptosCreados,
      conceptosActualizados,
    };
  }

  /** Trae el catálogo de conceptos del cliente como un mapa código→{baseIndemnizacion,
   * tipo}, para que los importadores de nómina/recibo lo usen sin repetir la
   * consulta por cada fila. `baseIndemnizacion` decide la base del art. 245
   * (§2.4); `tipo` (Remunerativo/No remunerativo/Descuento) decide, junto con
   * `rubroParaConcepto`, la base del SAC proporcional (§2.1) — son preguntas
   * legales distintas sobre el mismo concepto. Mapa vacío si el cliente
   * todavía no importó su catálogo. */
  private async obtenerCatalogoConceptos(clienteId: string): Promise<Map<string, { baseIndemnizacion: boolean; tipo: string }>> {
    const conceptos = await this.prisma.conceptoCliente.findMany({ where: { clienteId } });
    return new Map(conceptos.map((c) => [c.codigo, { baseIndemnizacion: c.baseIndemnizacion, tipo: c.tipo }]));
  }

  /**
   * Remuneración devengada del mes para el SAC proporcional (arts. 121-123
   * LCT, Ley 23.041) — distinta de `conceptosRemunerativos` (art. 245): acá sí
   * se netean los descuentos por mes parcial (p.ej. días no trabajados,
   * descuento por ingreso/egreso), porque el SAC se calcula sobre lo
   * efectivamente devengado ese mes, no sobre el sueldo "normal" del mes. Se
   * excluye el propio SAC proporcional del recibo (evita circularidad: no se
   * puede usar el SAC ya liquidado para calcular la base del SAC). Con
   * catálogo, usa `tipo === 'remunerativo'`; sin catálogo, cae al total
   * "Remunerativo" impreso del recibo (que ya neta esos descuentos) menos el
   * SAC proporcional detectado por nombre.
   */
  private remuneracionDevengadaSacDeRecibo(
    recibo: { conceptos: { codigo: string; concepto: string; monto: number }[]; remunerativo: number },
    catalogo: Map<string, { baseIndemnizacion: boolean; tipo: string }>,
  ): number {
    if (catalogo.size > 0) {
      return recibo.conceptos
        .filter((c) => catalogo.get(normalizarCodigoConcepto(c.codigo))?.tipo === 'remunerativo' && !rubroParaConcepto(c.concepto))
        .reduce((total, c) => total + c.monto, 0);
    }
    const sacDelRecibo = recibo.conceptos
      .filter((c) => rubroParaConcepto(c.concepto) === 'SAC_PROP')
      .reduce((total, c) => total + c.monto, 0);
    return recibo.remunerativo - sacDelRecibo;
  }

  async importarNomina(clienteId: string, buffer: Buffer): Promise<ResumenImportacion> {
    await this.asegurarCliente(clienteId);
    const filas = await parsearNomina(buffer);
    if (filas.length === 0) {
      throw new BadRequestException('El archivo no tiene filas de datos para importar');
    }

    const catalogo = await this.obtenerCatalogoConceptos(clienteId);
    const porCuil = this.agruparPorEmpleadoYPeriodo(filas, catalogo);

    let empleadosCreados = 0;
    let empleadosActualizados = 0;
    let mesesImportados = 0;
    const errores: string[] = [];

    for (const [cuil, datos] of porCuil) {
      try {
        const empleadoId = await this.obtenerOCrearEmpleado(clienteId, cuil, datos, (creado) => {
          if (creado) empleadosCreados++;
          else empleadosActualizados++;
        });

        for (const [periodoIso, agregado] of datos.meses) {
          await this.prisma.remuneracionMensual.upsert({
            where: { empleadoId_periodo: { empleadoId, periodo: new Date(periodoIso) } },
            create: {
              empleadoId,
              periodo: new Date(periodoIso),
              conceptosRemunerativos: agregado.conceptosRemunerativos,
              remuneracionDevengadaSac: agregado.remuneracionDevengadaSac,
              esNormalYHabitual: !agregado.tieneAjuste,
              detalle: { conceptos: agregado.detalleConceptos, conceptosNoRemunerativos: agregado.conceptosNoRemunerativos },
              fuente: 'importado',
            },
            update: {
              conceptosRemunerativos: agregado.conceptosRemunerativos,
              remuneracionDevengadaSac: agregado.remuneracionDevengadaSac,
              esNormalYHabitual: !agregado.tieneAjuste,
              detalle: { conceptos: agregado.detalleConceptos, conceptosNoRemunerativos: agregado.conceptosNoRemunerativos },
              fuente: 'importado',
            },
          });
          mesesImportados++;
        }
      } catch (error) {
        errores.push(`CUIL ${cuil}: ${(error as Error).message}`);
      }
    }

    return {
      filasProcesadas: filas.length,
      empleadosDetectados: porCuil.size,
      empleadosCreados,
      empleadosActualizados,
      mesesImportados,
      errores,
    };
  }

  /**
   * Importa un recibo de sueldo (PDF) de liquidación final: da de alta al
   * empleado si no existe (CUIL, nombre, categoría, fecha de ingreso, todos
   * del recibo), crea el `Caso` con el tipo y la fecha de extinción que indicó
   * el auditor (el recibo no los trae — no son datos de nómina), y carga la
   * `Liquidacion` de origen "empresa" con los rubros que el recibo sí trae
   * (SAC proporcional, vacaciones no gozadas actuales/anteriores y su SAC).
   * También registra la `RemuneracionMensual` del período del recibo. No es
   * idempotente: reimportar el mismo recibo crea un caso nuevo cada vez.
   */
  async importarRecibo(clienteId: string, buffer: Buffer, dto: ImportarReciboDto): Promise<ResumenImportacionRecibo> {
    await this.asegurarCliente(clienteId);
    const recibo = await parsearReciboLiquidacion(buffer);
    const catalogo = await this.obtenerCatalogoConceptos(clienteId);
    const baseCalculadaConCatalogo = catalogo.size > 0;
    const conceptosRemunerativos = baseCalculadaConCatalogo
      ? recibo.conceptos
          .filter((c) => catalogo.get(normalizarCodigoConcepto(c.codigo))?.baseIndemnizacion === true)
          .reduce((total, c) => total + c.monto, 0)
      : recibo.remunerativo;
    const remuneracionDevengadaSac = this.remuneracionDevengadaSacDeRecibo(recibo, catalogo);
    // `recibo.esPeriodoAtipico` marca meses parciales por los conceptos de ajuste
    // que trae el propio recibo (días no trabajados, descuento por ingreso/egreso
    // — típicos de una liquidación final). Con catálogo, esos conceptos de ajuste
    // no suelen estar marcados `baseIndemnizacion=true` (ver docs/motor-calculo.md
    // §2.4), así que ya quedan afuera de `conceptosRemunerativos`: el monto que
    // queda es la remuneración normal del mes, no una atípica a medias, y sí debe
    // competir por ser la MRMNH. Sin catálogo seguimos confiando en la heurística
    // de nombre porque `recibo.remunerativo` (el total impreso) sí puede incluir
    // esos ajustes.
    const esNormalYHabitual = baseCalculadaConCatalogo ? true : !recibo.esPeriodoAtipico;

    let empleadoCreado = false;
    const empleadoId = await this.obtenerOCrearEmpleado(
      clienteId,
      recibo.cuil,
      { nombre: recibo.nombre, fechaIngreso: recibo.fechaIngreso, categoria: recibo.categoria },
      (creado) => {
        empleadoCreado = creado;
      },
    );

    const caso = await this.prisma.caso.create({
      data: {
        empleadoId,
        tipoExtincion: dto.tipoExtincion,
        fechaExtincion: new Date(dto.fechaExtincion),
      },
    });

    await this.prisma.remuneracionMensual.upsert({
      where: { empleadoId_periodo: { empleadoId, periodo: recibo.periodo } },
      create: {
        empleadoId,
        periodo: recibo.periodo,
        conceptosRemunerativos,
        remuneracionDevengadaSac,
        esNormalYHabitual,
        detalle: { conceptos: recibo.conceptos } as unknown as Prisma.InputJsonValue,
        fuente: 'importado',
      },
      update: {
        conceptosRemunerativos,
        remuneracionDevengadaSac,
        esNormalYHabitual,
        detalle: { conceptos: recibo.conceptos } as unknown as Prisma.InputJsonValue,
        fuente: 'importado',
      },
    });

    const rubrosDeclarados: { rubroCodigo: string; concepto: string; monto: number }[] = [];
    const conceptosSinMapear: { concepto: string; monto: number }[] = [];
    for (const concepto of recibo.conceptos) {
      const rubroCodigo = rubroParaConcepto(concepto.concepto);
      if (rubroCodigo) rubrosDeclarados.push({ rubroCodigo, concepto: concepto.concepto, monto: concepto.monto });
      else conceptosSinMapear.push({ concepto: concepto.concepto, monto: concepto.monto });
    }

    if (rubrosDeclarados.length > 0) {
      const rubrosDb = await this.prisma.rubro.findMany({
        where: { codigo: { in: rubrosDeclarados.map((r) => r.rubroCodigo) } },
      });
      const rubroIdPorCodigo = new Map(rubrosDb.map((r) => [r.codigo, r.id]));
      await this.prisma.liquidacion.create({
        data: {
          casoId: caso.id,
          origen: 'empresa',
          rubros: {
            create: rubrosDeclarados
              .filter((r) => rubroIdPorCodigo.has(r.rubroCodigo))
              .map((r) => ({ rubroId: rubroIdPorCodigo.get(r.rubroCodigo)!, monto: r.monto })),
          },
        },
      });
    }

    const rubrosLegalesNoEncontradosEnElRecibo = ['IND_ANTIGUEDAD', 'PREAVISO', 'INTEGRACION_MES'].filter(
      (codigo) => !rubrosDeclarados.some((r) => r.rubroCodigo === codigo),
    );

    // El recibo trae, en la unidad del concepto "Vac No Gozadas Anterior", los
    // días de vacaciones de períodos previos que la empresa reconoce como deuda
    // — exactamente lo que pide `diasVacacionesPendientesPeriodosAnteriores`
    // (art. 156 LCT, ver docs/motor-calculo.md §4.6). A diferencia de los días
    // del año en curso (que el motor recalcula de forma independiente por
    // antigüedad — art. 150), acá no hay una fórmula legal para derivarlo: es
    // un dato histórico, así que tomar el que ya declaró la empresa en vez de
    // dejarlo en 0 por defecto no compromete la independencia de la auditoría.
    const diasVacacionesAnteriores = recibo.conceptos.find(
      (c) => rubroParaConcepto(c.concepto) === 'VAC_NO_GOZADAS_ANTERIORES' && c.unidad !== null,
    )?.unidad;
    if (diasVacacionesAnteriores !== undefined) {
      await this.prisma.variableCaso.upsert({
        where: { casoId_clave: { casoId: caso.id, clave: 'diasVacacionesPendientesPeriodosAnteriores' } },
        create: {
          casoId: caso.id,
          clave: 'diasVacacionesPendientesPeriodosAnteriores',
          valor: String(diasVacacionesAnteriores),
          fuente: 'importado',
        },
        update: {
          valor: String(diasVacacionesAnteriores),
          fuente: 'importado',
        },
      });
    }

    return {
      empresaDelRecibo: recibo.empresaNombre,
      cuitDelRecibo: recibo.empresaCuit,
      empleado: { id: empleadoId, nombre: recibo.nombre, cuil: recibo.cuil, creado: empleadoCreado },
      casoId: caso.id,
      remuneracionMensual: {
        periodo: recibo.periodo.toISOString().slice(0, 10),
        conceptosRemunerativos,
        esNormalYHabitual,
      },
      rubrosDeclarados,
      conceptosSinMapear,
      rubrosLegalesNoEncontradosEnElRecibo,
      baseCalculadaConCatalogo,
      diasVacacionesPendientesPeriodosAnteriores: diasVacacionesAnteriores ?? null,
    };
  }

  /**
   * Agrupa las filas sueltas (un renglón por concepto) en un agregado por
   * empleado (CUIL) y período. Para decidir si un concepto computa para
   * `conceptosRemunerativos` (la base de la MRMNH, art. 245 LCT) usa
   * `catalogo` — el `ConceptoCliente.baseIndemnizacion` del cliente, más
   * preciso que el `TIPO` de la fila (un concepto puede ser remunerativo y no
   * entrar en la base, p.ej. el SAC) — y solo cae al `TIPO='REMU'` de la fila
   * si ese código no está en el catálogo del cliente (o el cliente no
   * importó ninguno todavía). `remuneracionDevengadaSac` (base del SAC
   * proporcional, arts. 121-123) usa `catalogo.tipo === 'remunerativo'` en vez
   * de `baseIndemnizacion` (son preguntas legales distintas, ver
   * `remuneracionDevengadaSacDeRecibo`) y excluye las filas cuyo concepto
   * mapea a un rubro de liquidación final (`rubroParaConcepto`, p.ej. el
   * propio SAC) para evitar circularidad. Marca `tieneAjuste=true` si algún
   * renglón del mes viene de un proceso de liquidación cuyo nombre contiene
   * "ajuste" (heurística: un ajuste/retroactivo suele distorsionar el mes y
   * no debería competir por ser la "mejor" remuneración — el auditor puede
   * revisar y corregir el flag a mano después).
   */
  private agruparPorEmpleadoYPeriodo(
    filas: FilaNominaImportada[],
    catalogo: Map<string, { baseIndemnizacion: boolean; tipo: string }>,
  ): Map<string, DatosEmpleado> {
    const porCuil = new Map<string, DatosEmpleado>();

    for (const fila of filas) {
      let datosEmpleado = porCuil.get(fila.cuil);
      if (!datosEmpleado) {
        datosEmpleado = { nombre: fila.nombre, fechaIngreso: fila.fechaIngreso, categoria: fila.categoria, meses: new Map() };
        porCuil.set(fila.cuil, datosEmpleado);
      }

      const periodoIso = fila.periodo.toISOString().slice(0, 10);
      let agregado = datosEmpleado.meses.get(periodoIso);
      if (!agregado) {
        agregado = {
          conceptosRemunerativos: 0,
          conceptosNoRemunerativos: 0,
          remuneracionDevengadaSac: 0,
          detalleConceptos: [],
          tieneAjuste: false,
        };
        datosEmpleado.meses.set(periodoIso, agregado);
      }

      const infoConcepto = catalogo.get(normalizarCodigoConcepto(fila.codigo));
      const cuentaParaBase = infoConcepto?.baseIndemnizacion ?? fila.tipo === 'REMU';
      if (cuentaParaBase) agregado.conceptosRemunerativos += fila.monto;
      else agregado.conceptosNoRemunerativos += fila.monto;

      const esRemunerativoParaSac = infoConcepto ? infoConcepto.tipo === 'remunerativo' : fila.tipo === 'REMU';
      if (esRemunerativoParaSac && !rubroParaConcepto(fila.concepto)) agregado.remuneracionDevengadaSac += fila.monto;

      agregado.detalleConceptos.push({ concepto: fila.concepto, monto: fila.monto, tipo: fila.tipo });
      if (/ajuste/i.test(fila.proceso)) agregado.tieneAjuste = true;
    }

    return porCuil;
  }

  /** Busca el `Empleado` por CUIL dentro del cliente; si no existe, lo da de
   * alta con los datos del archivo (nombre, fecha de ingreso, categoría). */
  private async obtenerOCrearEmpleado(
    clienteId: string,
    cuil: string,
    datos: { nombre: string; fechaIngreso: Date; categoria: string | null },
    reportarCreado: (creado: boolean) => void,
  ): Promise<string> {
    const existente = await this.prisma.empleado.findUnique({ where: { clienteId_cuil: { clienteId, cuil } } });
    if (existente) {
      reportarCreado(false);
      return existente.id;
    }

    const creado = await this.prisma.empleado.create({
      data: {
        clienteId,
        cuil,
        nombre: datos.nombre,
        fechaIngreso: datos.fechaIngreso,
        categoria: datos.categoria,
      },
    });
    reportarCreado(true);
    return creado.id;
  }

  private async asegurarCliente(clienteId: string): Promise<void> {
    const cliente = await this.prisma.cliente.findUnique({ where: { id: clienteId } });
    if (!cliente) throw new NotFoundException(`Cliente ${clienteId} no encontrado`);
  }
}
