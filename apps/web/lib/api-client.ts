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

export interface Empleado {
  id: string;
  nombre: string;
  cuil: string;
  fechaIngreso: string;
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

export interface RemuneracionMensual {
  id: string;
  periodo: string;
  conceptosRemunerativos: string;
  esNormalYHabitual: boolean;
  detalle: Record<string, number> | null;
  fuente: 'manual' | 'ocr' | 'importado';
}

export interface UpsertRemuneracionMensual {
  conceptosRemunerativos: number;
  esNormalYHabitual?: boolean;
  detalle?: Record<string, number>;
  fuente?: 'manual' | 'ocr' | 'importado';
}

export interface CasoDetalle extends Caso {
  variables: VariableCaso[];
  documentos: Documento[];
  remuneracionesMensuales: RemuneracionMensual[];
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

export const apiClient = {
  listarClientes: () => request<Cliente[]>('/clientes'),
  obtenerCliente: (id: string) => request<Cliente>(`/clientes/${id}`),
  listarCasosIndividuales: (clienteId: string) => request<Caso[]>(`/casos?clienteId=${clienteId}`),
  listarLotes: (clienteId: string) => request<unknown[]>(`/lotes?clienteId=${clienteId}`),
  obtenerCaso: (id: string) => request<CasoDetalle>(`/casos/${id}`),
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
  guardarRemuneracionMensual: (casoId: string, periodo: string, dto: UpsertRemuneracionMensual) =>
    request<RemuneracionMensual>(`/casos/${casoId}/remuneraciones-mensuales/${periodo}`, {
      method: 'PUT',
      body: JSON.stringify(dto),
    }),
  eliminarRemuneracionMensual: (casoId: string, periodo: string) =>
    request<void>(`/casos/${casoId}/remuneraciones-mensuales/${periodo}`, { method: 'DELETE' }),
};
