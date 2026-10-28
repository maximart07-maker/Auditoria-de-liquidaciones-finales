const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const respuesta = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    cache: 'no-store',
  });

  if (!respuesta.ok) {
    const cuerpo = await respuesta.text();
    throw new Error(`API ${respuesta.status} en ${path}: ${cuerpo}`);
  }
  if (respuesta.status === 204) return undefined as T;
  return respuesta.json() as Promise<T>;
}

export interface Cliente {
  id: string;
  razonSocial: string;
  cuit: string;
  industria: string | null;
}

export interface RemuneracionMensual {
  id: string;
  periodo: string;
  conceptosRemunerativos: string;
  esNormalYHabitual: boolean;
  detalle: Record<string, unknown> | null;
  fuente: 'manual' | 'ocr' | 'importado';
}

export interface UpsertRemuneracionMensual {
  conceptosRemunerativos: number;
  esNormalYHabitual?: boolean;
  detalle?: Record<string, unknown>;
  fuente?: 'manual' | 'ocr' | 'importado';
}

export interface Empleado {
  id: string;
  clienteId: string;
  nombre: string;
  cuil: string;
  fechaIngreso: string;
  /** Solo viene incluido en `CasoDetalle.empleado` (vía `obtenerCaso`), no en los listados. */
  remuneracionesMensuales?: RemuneracionMensual[];
}

export interface Caso {
  id: string;
  tipoExtincion: string;
  fechaExtincion: string;
  estado: 'borrador' | 'en_revision' | 'auditado' | 'cerrado';
  empleado: Empleado;
}

export interface VariableCaso {
  id: string;
  clave: string;
  valor: string;
  fuente: 'manual' | 'ocr' | 'importado';
  confianza: string | null;
}

export interface Documento {
  id: string;
  tipo: string;
  archivoUrl: string;
  estadoProcesamiento: 'pendiente' | 'procesando' | 'procesado' | 'error';
  uploadedAt: string;
}

export interface RubroLiquidacion {
  monto: string;
  rubro: { codigo: string; nombre: string };
}

export interface Liquidacion {
  id: string;
  origen: 'empresa' | 'sistema';
  version: number;
  rubros: RubroLiquidacion[];
}

export interface Hallazgo {
  id: string;
  rubro: { codigo: string; nombre: string };
  montoDeclarado: string;
  montoCalculado: string;
  porcentajeDiferencia: string | null;
  severidad: 'alta' | 'media' | 'baja' | null;
  estado: 'pendiente' | 'validado' | 'descartado';
}

export interface Auditoria {
  id: string;
  fecha: string;
  estado: 'ok' | 'con_diferencias' | 'requiere_revision';
  resumen: string | null;
  hallazgos: Hallazgo[];
}

export interface CasoDetalle extends Caso {
  variables: VariableCaso[];
  documentos: Documento[];
  liquidaciones: Liquidacion[];
  auditorias: Auditoria[];
}

export interface ConfiguracionRubro {
  rubro: { id: string; codigo: string; nombre: string; baseLegal: string | null; esLegal: boolean };
  tipo: 'fijo' | 'variable';
  activo: boolean;
  valorFijo: string | null;
  parametros: Record<string, number> | null;
  personalizado: boolean;
}

export interface UpsertConfiguracionRubro {
  tipo: 'fijo' | 'variable';
  activo: boolean;
  valorFijo?: number;
  parametros?: Record<string, number>;
  nombre?: string;
  baseLegal?: string;
}

export interface ResumenImportacion {
  filasProcesadas: number;
  empleadosDetectados: number;
  empleadosCreados: number;
  empleadosActualizados: number;
  mesesImportados: number;
  errores: string[];
  advertencias: string[];
}

export interface Rubro {
  id: string;
  codigo: string;
  nombre: string;
  baseLegal: string | null;
}

export interface CrearClienteInput {
  razonSocial: string;
  cuit: string;
  industria?: string;
  contactoEmail?: string;
}

export interface CrearEmpleadoInput {
  clienteId: string;
  nombre: string;
  cuil: string;
  fechaIngreso: string;
  categoria?: string;
  convenioColectivo?: string;
  provincia?: string;
}

export interface CrearCasoInput {
  empleadoId: string;
  tipoExtincion: string;
  fechaExtincion: string;
}

export interface SetVariableInput {
  clave: string;
  valor: string;
  fuente: 'manual' | 'ocr' | 'importado';
}

export interface RubroMontoInput {
  rubroCodigo: string;
  monto: number;
}

export interface ResumenImportacionRecibo {
  empresaDelRecibo: string | null;
  cuitDelRecibo: string | null;
  empleado: { id: string; nombre: string; cuil: string; creado: boolean };
  casoId: string;
  remuneracionMensual: {
    periodo: string;
    conceptosRemunerativos: number;
    esNormalYHabitual: boolean;
    registrada: 'recibo' | 'ya_existia' | 'sin_base';
  };
  rubrosDeclarados: { rubroCodigo: string; concepto: string; monto: number }[];
  conceptosSinMapear: { concepto: string; monto: number }[];
  rubrosLegalesNoEncontradosEnElRecibo: string[];
  baseCalculadaConCatalogo: boolean;
  diasVacacionesPendientesPeriodosAnteriores: number | null;
}

export interface ResumenImportacionConceptos {
  clienteId: string;
  conceptosProcesados: number;
  conceptosCreados: number;
  conceptosActualizados: number;
}

export type TipoEmpleadorSUSS = 'pyme' | 'gran_empresa';
export type RegimenDiferencialSUSS = 'comun' | 'choferes' | 'construccion' | 'docentes' | 'insalubres' | 'manual';
export type RegimenDetraccion = 'general' | 'incrementado' | 'sin_detraccion';

export interface ConfiguracionCargasSociales {
  tipoEmpleador: TipoEmpleadorSUSS;
  regimenDiferencial: RegimenDiferencialSUSS;
  adicionalDiferencialPorcentaje: number;
  aplicaFAL: boolean;
  artPorcentaje: number;
  artCuotaFija: number;
  scvoPorEmpleado: number;
  regimenDetraccion: RegimenDetraccion;
  montoDetraccionPersonalizado: number | null;
  horasSemanalesJornadaParcial: number | null;
}

export interface CargasSocialesCliente {
  configurado: boolean;
  configuracion: ConfiguracionCargasSociales;
}

export interface CalculoCargasSocialesInput {
  sueldoBruto: number;
  cantidadEmpleados: number;
  incluyeSAC: boolean;
}

export interface LineaCargasSociales {
  concepto: 'SUSS' | 'OBRA_SOCIAL' | 'FAL' | 'ART' | 'SCVO';
  descripcion: string;
  baseImponible: number | null;
  alicuota: number | null;
  fijo: number | null;
  importePorEmpleado: number;
  importeTotal: number;
}

export interface ResultadoCargasSociales {
  resumen: {
    alicuotaSUSSBase: number;
    adicionalDiferencial: number;
    alicuotaSUSSTotal: number;
    factorJornada: number;
    horasSemanales: number;
    montoDetraccionBase: number;
    montoDetraccionAplicado: number;
    alicuotaFAL: number;
  };
  lineas: LineaCargasSociales[];
  totales: {
    sueldoBrutoPorEmpleado: number;
    sueldoBrutoTotal: number;
    cargasPorEmpleado: number;
    cargasTotal: number;
    costoLaboralPorEmpleado: number;
    costoLaboralTotal: number;
    sobrecostoPorcentaje: number;
  };
}

// --- Nómina mensual › Control de Leyes (reporte F.931) ---

export interface ReporteF931Resumen {
  /** AAAA-MM */
  periodo: string;
  nombreArchivo: string;
  importadoEl: string;
  cantidadEmpleados: number;
}

export interface ResultadoImportacionReporteF931 {
  periodos: { periodo: string; cantidadEmpleados: number; reemplazado: boolean }[];
  errores: string[];
  advertencias: string[];
}

export type BaseF931 =
  | 'remuneracion1'
  | 'remuneracion2'
  | 'remuneracion4'
  | 'remuneracion5'
  | 'remuneracion8'
  | 'remuneracion9'
  | 'remuneracion10';

export interface ConceptoF931 {
  codigo: string;
  descripcion: string;
  base: BaseF931 | null;
  baseEtiqueta: string | null;
  baseTotal: number | null;
  alicuota: number | null;
  fijoPorEmpleado: number | null;
  importe: number | null;
  pendiente: string | null;
}

export interface ControlF931 {
  resumen: {
    cantidadEmpleados: number;
    remuneracionTotal: number;
    totalDetraer: number;
    totalContribuciones: number;
    totalAportes: number;
    alicuotaSUSSTotal: number;
    montoDetraccionCliente: number;
  };
  bases: { base: BaseF931; etiqueta: string; descripcion: string; total: number }[];
  contribuciones: ConceptoF931[];
  aportes: ConceptoF931[];
  observaciones: {
    severidad: 'alta' | 'media' | 'baja';
    titulo: string;
    detalle: string;
    empleados: { cuil: string; nombre: string; legajo: string }[];
  }[];
  modalidades: { codigo: string; descripcion: string | null; cantidadEmpleados: number; tratamiento: string }[];
  empleados: {
    legajo: string;
    nombre: string;
    cuil: string;
    modalidadContratacion: string;
    modalidadDescripcion: string | null;
    condicion: string;
    convenio: string;
    remuneracionTotal: number;
    bases: Record<BaseF931, number>;
    totalDetraer: number;
    contribuciones: Record<string, number>;
    totalContribuciones: number;
    aportes: Record<string, number>;
    totalAportes: number;
  }[];
}

export interface DiferenciaDDJJ {
  grupo: 'presencia' | 'modalidad' | 'base' | 'importe' | 'declaracion';
  concepto: string;
  valorSistema: number | string | null;
  valorDDJJ: number | string | null;
  diferencia: number | null;
  detalle?: string;
}

export interface CruceDDJJ {
  resumen: {
    empleadosReporte: number;
    empleadosDDJJ: number;
    sinDiferencias: number;
    conDiferencias: number;
    soloEnReporte: number;
    soloEnDDJJ: number;
    remuneracionTotalPorRedondeo: number;
    pasantesConSCVO: number;
    coberturaSCVOSinDato: boolean;
  };
  totalesImportes: { codigo: string; concepto: string; app: number; ddjj: number; diferencia: number }[];
  empleados: { cuil: string; nombre: string; legajo: string | null; diferencias: DiferenciaDDJJ[] }[];
}

export interface ControlDeLeyes {
  periodo: string;
  nombreArchivo: string;
  cargasSocialesConfiguradas: boolean;
  control: ControlF931 | null;
  /** Nómina de Declaración en Línea del mismo período, si se importó. */
  ddjj: { nombreArchivo: string; secuencia: string | null; cantidadEmpleados: number } | null;
  cruce: CruceDDJJ | null;
}

export const apiClient = {
  obtenerCargasSociales: (clienteId: string) => request<CargasSocialesCliente>(`/clientes/${clienteId}/cargas-sociales`),
  guardarCargasSociales: (clienteId: string, dto: ConfiguracionCargasSociales) =>
    request<CargasSocialesCliente>(`/clientes/${clienteId}/cargas-sociales`, { method: 'PUT', body: JSON.stringify(dto) }),
  calcularCargasSociales: (clienteId: string, dto: CalculoCargasSocialesInput) =>
    request<ResultadoCargasSociales>(`/clientes/${clienteId}/cargas-sociales/calculo`, {
      method: 'POST',
      body: JSON.stringify(dto),
    }),
  listarClientes: () => request<Cliente[]>('/clientes'),
  obtenerCliente: (id: string) => request<Cliente>(`/clientes/${id}`),
  crearCliente: (dto: CrearClienteInput) =>
    request<Cliente>('/clientes', { method: 'POST', body: JSON.stringify(dto) }),
  listarEmpleados: (clienteId: string) => request<Empleado[]>(`/empleados?clienteId=${clienteId}`),
  crearEmpleado: (dto: CrearEmpleadoInput) =>
    request<Empleado>('/empleados', { method: 'POST', body: JSON.stringify(dto) }),
  listarCasosIndividuales: (clienteId: string) => request<Caso[]>(`/casos?clienteId=${clienteId}`),
  crearCaso: (dto: CrearCasoInput) => request<Caso>('/casos', { method: 'POST', body: JSON.stringify(dto) }),
  listarLotes: (clienteId: string) => request<unknown[]>(`/lotes?clienteId=${clienteId}`),
  obtenerCaso: (id: string) => request<CasoDetalle>(`/casos/${id}`),
  eliminarCaso: (id: string) => request<void>(`/casos/${id}`, { method: 'DELETE' }),
  guardarVariable: (casoId: string, dto: SetVariableInput) =>
    request<VariableCaso>(`/casos/${casoId}/variables`, { method: 'PUT', body: JSON.stringify(dto) }),
  guardarLiquidacionEmpresa: (casoId: string, rubros: RubroMontoInput[]) =>
    request<Liquidacion>(`/casos/${casoId}/liquidaciones`, {
      method: 'POST',
      body: JSON.stringify({ origen: 'empresa', rubros }),
    }),
  listarRubros: () => request<Rubro[]>('/rubros'),
  ejecutarAuditoria: (casoId: string) =>
    request<Auditoria>(`/casos/${casoId}/auditorias`, { method: 'POST', body: JSON.stringify({}) }),
  listarConfiguracionesRubro: (clienteId: string) =>
    request<ConfiguracionRubro[]>(`/clientes/${clienteId}/configuraciones-rubro`),
  guardarConfiguracionRubro: (clienteId: string, codigoRubro: string, dto: UpsertConfiguracionRubro) =>
    request<ConfiguracionRubro>(`/clientes/${clienteId}/configuraciones-rubro/${codigoRubro}`, {
      method: 'PUT',
      body: JSON.stringify(dto),
    }),
  eliminarConfiguracionRubro: (clienteId: string, codigoRubro: string) =>
    request<void>(`/clientes/${clienteId}/configuraciones-rubro/${codigoRubro}`, { method: 'DELETE' }),
  guardarRemuneracionMensual: (empleadoId: string, periodo: string, dto: UpsertRemuneracionMensual) =>
    request<RemuneracionMensual>(`/empleados/${empleadoId}/remuneraciones-mensuales/${periodo}`, {
      method: 'PUT',
      body: JSON.stringify(dto),
    }),
  eliminarRemuneracionMensual: (empleadoId: string, periodo: string) =>
    request<void>(`/empleados/${empleadoId}/remuneraciones-mensuales/${periodo}`, { method: 'DELETE' }),
  importarNomina: async (clienteId: string, archivo: File): Promise<ResumenImportacion> => {
    const formData = new FormData();
    formData.append('archivo', archivo);
    const respuesta = await fetch(`${API_URL}/clientes/${clienteId}/importaciones/nomina`, {
      method: 'POST',
      body: formData,
    });
    if (!respuesta.ok) {
      const cuerpo = await respuesta.text();
      throw new Error(`API ${respuesta.status} en /importaciones/nomina: ${cuerpo}`);
    }
    return respuesta.json() as Promise<ResumenImportacion>;
  },
  importarRecibo: async (
    clienteId: string,
    archivo: File,
    tipoExtincion: string,
    fechaExtincion: string,
  ): Promise<ResumenImportacionRecibo> => {
    const formData = new FormData();
    formData.append('archivo', archivo);
    formData.append('tipoExtincion', tipoExtincion);
    formData.append('fechaExtincion', fechaExtincion);
    const respuesta = await fetch(`${API_URL}/clientes/${clienteId}/importaciones/recibo`, {
      method: 'POST',
      body: formData,
    });
    if (!respuesta.ok) {
      const cuerpo = await respuesta.text();
      throw new Error(`API ${respuesta.status} en /importaciones/recibo: ${cuerpo}`);
    }
    return respuesta.json() as Promise<ResumenImportacionRecibo>;
  },
  importarConceptos: async (clienteId: string, archivo: File): Promise<ResumenImportacionConceptos> => {
    const formData = new FormData();
    formData.append('archivo', archivo);
    const respuesta = await fetch(`${API_URL}/clientes/${clienteId}/importaciones/conceptos`, {
      method: 'POST',
      body: formData,
    });
    if (!respuesta.ok) {
      const cuerpo = await respuesta.text();
      throw new Error(`API ${respuesta.status} en /importaciones/conceptos: ${cuerpo}`);
    }
    return respuesta.json() as Promise<ResumenImportacionConceptos>;
  },
  listarReportesF931: (clienteId: string) =>
    request<ReporteF931Resumen[]>(`/clientes/${clienteId}/nomina-mensual/reportes-f931`),
  obtenerControlDeLeyes: (clienteId: string, periodo: string) =>
    request<ControlDeLeyes>(`/clientes/${clienteId}/nomina-mensual/control-de-leyes?periodo=${periodo}`),
  importarReporteF931: (clienteId: string, archivo: File) =>
    subirCsvNominaMensual(`/clientes/${clienteId}/nomina-mensual/reportes-f931`, archivo),
  importarNominaDDJJ: (clienteId: string, archivo: File) =>
    subirCsvNominaMensual(`/clientes/${clienteId}/nomina-mensual/nominas-ddjj`, archivo),
};

/** Sube un CSV del módulo Nómina mensual y devuelve el mensaje de error de la API tal cual. */
async function subirCsvNominaMensual(ruta: string, archivo: File): Promise<ResultadoImportacionReporteF931> {
  const formData = new FormData();
  formData.append('archivo', archivo);
  const respuesta = await fetch(`${API_URL}${ruta}`, {
    method: 'POST',
    body: formData,
  });
  if (!respuesta.ok) {
    const cuerpo = await respuesta.text();
    let mensaje = cuerpo;
    try {
      const json = JSON.parse(cuerpo) as { message?: string | string[] };
      if (json.message) mensaje = Array.isArray(json.message) ? json.message.join(' ') : json.message;
    } catch {
      // cuerpo no JSON: se muestra tal cual
    }
    throw new Error(mensaje);
  }
  return respuesta.json() as Promise<ResultadoImportacionReporteF931>;
}
