import PDFDocument from 'pdfkit';
import { ConceptoF931, ResultadoControlF931, ResultadoCruceDDJJ } from '@audit/motor-calculo';

/** Todo lo que lleva el informe de Control de Leyes de un período (lo mismo que muestra el panel). */
export interface DatosInformeControlLeyes {
  cliente: { razonSocial: string; cuit: string };
  /** AAAA-MM */
  periodo: string;
  nombreArchivoReporte: string;
  ddjj: { nombreArchivo: string; secuencia: string | null } | null;
  control: ResultadoControlF931;
  cruce: ResultadoCruceDDJJ | null;
  emitido: Date;
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function nombrePeriodo(periodo: string): string {
  const [anio, mes] = periodo.split('-').map(Number);
  return `${MESES[mes - 1]} ${anio}`;
}

/** Nombre del archivo a descargar, sin espacios ni acentos. */
export function nombreArchivoInforme(datos: DatosInformeControlLeyes, extension: 'pdf' | 'csv'): string {
  const cuit = datos.cliente.cuit.replace(/\D/g, '');
  return `Control_de_Leyes_${cuit}_${datos.periodo}.${extension}`;
}

const pesos = (v: number | null) =>
  v === null ? '—' : v.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const porcentaje = (v: number | null) =>
  v === null ? '—' : `${v.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
const fechaHora = (d: Date) =>
  d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Argentina/Buenos_Aires' });

const GRUPO_DIFERENCIA: Record<string, string> = {
  presencia: 'Presencia',
  modalidad: 'Modalidad',
  base: 'Base',
  importe: 'Importe',
  declaracion: 'Declaración',
};

// ---------------------------------------------------------------------------
// CSV (para Excel: separado por ";", decimales con coma, UTF-8 con BOM)
// ---------------------------------------------------------------------------

/** Número para Excel en español: sin separador de miles y con coma decimal. */
const numeroCsv = (v: number | null | undefined) => (v === null || v === undefined ? '' : v.toFixed(2).replace('.', ','));

function celdaCsv(valor: string | number | null | undefined): string {
  if (typeof valor === 'number') return numeroCsv(valor);
  const texto = valor ?? '';
  return /[;"\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

export function generarCsvControlLeyes(d: DatosInformeControlLeyes): Buffer {
  const filas: (string | number | null | undefined)[][] = [];
  const fila = (...celdas: (string | number | null | undefined)[]) => filas.push(celdas);
  const blanco = () => filas.push([]);
  const { control, cruce } = d;

  fila('Informe de Control de Leyes - F.931');
  fila('Cliente', d.cliente.razonSocial);
  fila('CUIT', d.cliente.cuit);
  fila('Período', nombrePeriodo(d.periodo));
  fila('Reporte del sistema de liquidación', d.nombreArchivoReporte);
  fila('Nómina de Declaración en Línea', d.ddjj ? `${d.ddjj.nombreArchivo}${d.ddjj.secuencia ? ` (secuencia ${d.ddjj.secuencia})` : ''}` : 'No importada');
  fila('Emitido', fechaHora(d.emitido));
  blanco();

  fila('RESUMEN');
  fila('Empleados', String(control.resumen.cantidadEmpleados));
  fila('Remuneración total', control.resumen.remuneracionTotal);
  fila('Contribuciones calculadas', control.resumen.totalContribuciones);
  fila('Aportes calculados', control.resumen.totalAportes);
  blanco();

  const conceptos = (titulo: string, lista: ConceptoF931[], total: number) => {
    fila(titulo);
    fila('Concepto', 'Base', 'Base imponible', 'Alícuota %', 'Fijo por empleado', 'Importe');
    for (const c of lista) fila(c.descripcion, c.baseEtiqueta ?? '', c.baseTotal, c.alicuota, c.fijoPorEmpleado, c.importe);
    fila('Total', '', null, null, null, total);
    blanco();
  };
  conceptos('CONTRIBUCIONES PATRONALES', control.contribuciones, control.resumen.totalContribuciones);
  conceptos('APORTES PERSONALES', control.aportes, control.resumen.totalAportes);

  fila('OBSERVACIONES DEL CONTROL');
  fila('Severidad', 'Observación', 'Detalle', 'Legajo', 'Empleado', 'CUIL');
  for (const o of control.observaciones) {
    for (const e of o.empleados) fila(o.severidad, o.titulo, o.detalle, e.legajo, e.nombre, e.cuil);
  }
  if (control.observaciones.length === 0) fila('', 'Sin observaciones');
  blanco();

  fila('EMPLEADOS POR MODALIDAD DE CONTRATACIÓN');
  fila('Código', 'Modalidad', 'Empleados', 'Qué se calcula');
  for (const m of control.modalidades) fila(m.codigo, m.descripcion ?? 'Fuera del catálogo', String(m.cantidadEmpleados), m.tratamiento);
  blanco();

  fila('CRUCE CON DECLARACIÓN EN LÍNEA');
  if (!cruce) {
    fila('No se importó la nómina de Declaración en Línea de este período.');
  } else {
    const r = cruce.resumen;
    fila('Sin diferencias', String(r.sinDiferencias));
    fila('Con diferencias', String(r.conDiferencias));
    fila('Solo en el reporte', String(r.soloEnReporte));
    fila('Solo en la DDJJ', String(r.soloEnDDJJ));
    fila('Diferencias de redondeo no listadas (Remuneración Total)', String(r.remuneracionTotalPorRedondeo));
    fila('Pasantes declarados con SCVO', String(r.pasantesConSCVO));
    blanco();
    fila('Legajo', 'Empleado', 'CUIL', 'Tipo', 'Concepto', 'Sistema / App', 'DDJJ', 'Diferencia', 'Detalle');
    for (const e of cruce.empleados) {
      for (const x of e.diferencias) {
        fila(e.legajo ?? '', e.nombre, e.cuil, GRUPO_DIFERENCIA[x.grupo] ?? x.grupo, x.concepto, x.valorSistema, x.valorDDJJ, x.diferencia, x.detalle ?? '');
      }
    }
    if (cruce.empleados.length === 0) fila('', 'El reporte y la DDJJ coinciden en todos los CUIL.');
    blanco();
    fila('Totales por concepto (CUIL en ambos archivos)', 'App', 'DDJJ', 'Diferencia');
    for (const t of cruce.totalesImportes) fila(t.concepto, t.app, t.ddjj, t.diferencia);
  }
  blanco();

  fila('DETALLE POR EMPLEADO');
  fila(
    'Legajo',
    'Empleado',
    'CUIL',
    'Contrato',
    'Modalidad',
    'Remuneración total',
    'Rem. 1',
    'Rem. 2',
    'Rem. 4',
    'Rem. 5',
    'Rem. 8',
    'Rem. 9',
    'Rem. 10',
    'Detracción',
    ...control.contribuciones.map((c) => c.descripcion),
    'Total contribuciones',
    ...control.aportes.map((a) => a.descripcion),
    'Total aportes',
  );
  for (const e of control.empleados) {
    fila(
      e.legajo,
      e.nombre,
      e.cuil,
      e.modalidadContratacion,
      e.modalidadDescripcion ?? '',
      e.remuneracionTotal,
      e.bases.remuneracion1,
      e.bases.remuneracion2,
      e.bases.remuneracion4,
      e.bases.remuneracion5,
      e.bases.remuneracion8,
      e.bases.remuneracion9,
      e.bases.remuneracion10,
      e.totalDetraer,
      ...control.contribuciones.map((c) => e.contribuciones[c.codigo]),
      e.totalContribuciones,
      ...control.aportes.map((a) => e.aportes[a.codigo]),
      e.totalAportes,
    );
  }

  const texto = filas.map((f) => f.map(celdaCsv).join(';')).join('\r\n') + '\r\n';
  return Buffer.from('﻿' + texto, 'utf8');
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

const COLOR = {
  indigo: '#011E41',
  magenta: '#E4386A',
  texto: '#1e293b',
  suave: '#64748b',
  linea: '#e2e8f0',
  fondoTitulo: '#f1f5f9',
  severidad: { alta: '#dc2626', media: '#d97706', baja: '#16a34a' } as Record<string, string>,
};

interface Columna {
  titulo: string;
  /** Proporción del ancho disponible. */
  ancho: number;
  alinear?: 'left' | 'right';
}

type Doc = InstanceType<typeof PDFDocument>;

/**
 * Tabla con encabezado que se repite en cada página. Con `continuarPrimeraColumna`, una fila con la
 * primera celda vacía que queda al principio de una página nueva repite el último valor con "(cont.)".
 */
function tabla(
  doc: Doc,
  columnas: Columna[],
  filas: string[][],
  opciones: { negritaUltima?: boolean; continuarPrimeraColumna?: boolean } = {},
) {
  const x0 = doc.page.margins.left;
  const anchoTotal = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const suma = columnas.reduce((a, c) => a + c.ancho, 0);
  const anchos = columnas.map((c) => (c.ancho / suma) * anchoTotal);
  const pad = 4;
  const limite = () => doc.page.height - doc.page.margins.bottom - 20;

  const altoFila = (celdas: string[], fuente: string) => {
    doc.font(fuente).fontSize(8);
    return Math.max(...celdas.map((t, i) => doc.heightOfString(t || ' ', { width: anchos[i] - pad * 2 }))) + pad * 2;
  };
  let ultimaPrimera = '';
  const dibujar = (celdasOriginales: string[], fuente: string, fondo?: string, color = COLOR.texto) => {
    let celdas = celdasOriginales;
    if (doc.y + altoFila(celdas, fuente) > limite()) {
      // Se guarda antes de dibujar el encabezado, que también pasa por acá.
      const anterior = ultimaPrimera;
      doc.addPage();
      encabezado();
      if (opciones.continuarPrimeraColumna && !celdas[0] && anterior) {
        celdas = [`${anterior.split('\n')[0]} (cont.)`, ...celdas.slice(1)];
      }
      ultimaPrimera = anterior;
    }
    if (celdasOriginales[0] && fondo === undefined) ultimaPrimera = celdasOriginales[0];
    const alto = altoFila(celdas, fuente);
    const y = doc.y;
    if (fondo) doc.rect(x0, y, anchoTotal, alto).fill(fondo);
    let x = x0;
    doc.font(fuente).fontSize(8).fillColor(color);
    celdas.forEach((t, i) => {
      doc.text(t || '', x + pad, y + pad, { width: anchos[i] - pad * 2, align: columnas[i].alinear ?? 'left' });
      x += anchos[i];
    });
    doc.moveTo(x0, y + alto).lineTo(x0 + anchoTotal, y + alto).lineWidth(0.5).strokeColor(COLOR.linea).stroke();
    doc.x = x0;
    doc.y = y + alto;
  };
  const encabezado = () => dibujar(columnas.map((c) => c.titulo), 'Helvetica-Bold', COLOR.fondoTitulo, COLOR.suave);

  encabezado();
  filas.forEach((f, i) => dibujar(f, opciones.negritaUltima && i === filas.length - 1 ? 'Helvetica-Bold' : 'Helvetica'));
  doc.moveDown(0.8);
}

function seccion(doc: Doc, titulo: string) {
  if (doc.y > doc.page.height - doc.page.margins.bottom - 80) doc.addPage();
  doc.moveDown(0.6);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(COLOR.indigo).text(titulo.toUpperCase(), doc.page.margins.left);
  doc.moveDown(0.3);
}

function parrafo(doc: Doc, texto: string, opciones: { color?: string; tamano?: number; negrita?: boolean } = {}) {
  doc
    .font(opciones.negrita ? 'Helvetica-Bold' : 'Helvetica')
    .fontSize(opciones.tamano ?? 8.5)
    .fillColor(opciones.color ?? COLOR.texto)
    .text(texto, doc.page.margins.left, doc.y, { width: doc.page.width - doc.page.margins.left - doc.page.margins.right });
}

const filasConceptos = (lista: ConceptoF931[], total: number) => [
  ...lista.map((c) => [
    c.descripcion,
    c.baseEtiqueta ?? '—',
    pesos(c.baseTotal),
    porcentaje(c.alicuota),
    c.fijoPorEmpleado ? pesos(c.fijoPorEmpleado) : '—',
    pesos(c.importe),
  ]),
  ['Total', '', '', '', '', pesos(total)],
];

const COLUMNAS_CONCEPTOS: Columna[] = [
  { titulo: 'Concepto', ancho: 34 },
  { titulo: 'Base', ancho: 8 },
  { titulo: 'Base imponible', ancho: 17, alinear: 'right' },
  { titulo: 'Alícuota', ancho: 10, alinear: 'right' },
  { titulo: 'Fijo x empleado', ancho: 12, alinear: 'right' },
  { titulo: 'Importe', ancho: 17, alinear: 'right' },
];

export function generarPdfControlLeyes(d: DatosInformeControlLeyes): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 40, bottom: 40, left: 40, right: 40 },
    bufferPages: true,
    info: { Title: `Control de Leyes ${nombrePeriodo(d.periodo)} - ${d.cliente.razonSocial}`, Author: 'Auditoría Control de Nómina' },
  });
  const partes: Buffer[] = [];
  doc.on('data', (p: Buffer) => partes.push(p));
  const fin = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(partes)));
    doc.on('error', reject);
  });
  const { control, cruce } = d;
  const ancho = doc.page.width;

  // Encabezado
  doc.rect(0, 0, ancho, 70).fill(COLOR.indigo);
  doc.rect(0, 70, ancho, 3).fill(COLOR.magenta);
  doc.font('Helvetica-Bold').fontSize(16).fillColor('#ffffff').text('Informe de Control de Leyes', 40, 22);
  doc.font('Helvetica').fontSize(9).fillColor('#ffffff').text('Conceptos de seguridad social del F.931 · Auditoría Control de Nómina', 40, 44);
  doc.y = 90;

  parrafo(doc, d.cliente.razonSocial, { negrita: true, tamano: 12, color: COLOR.indigo });
  parrafo(doc, `CUIT ${d.cliente.cuit} · Período ${nombrePeriodo(d.periodo)}`);
  parrafo(
    doc,
    `Reporte del sistema: ${d.nombreArchivoReporte} · Nómina DDJJ: ${
      d.ddjj ? `${d.ddjj.nombreArchivo}${d.ddjj.secuencia ? ` (secuencia ${d.ddjj.secuencia})` : ''}` : 'no importada'
    } · Emitido el ${fechaHora(d.emitido)}`,
    { color: COLOR.suave, tamano: 8 },
  );

  seccion(doc, 'Resumen');
  tabla(
    doc,
    [
      { titulo: 'Empleados', ancho: 1, alinear: 'right' },
      { titulo: 'Remuneración total', ancho: 1, alinear: 'right' },
      { titulo: 'Contribuciones calculadas', ancho: 1, alinear: 'right' },
      { titulo: 'Aportes calculados', ancho: 1, alinear: 'right' },
    ],
    [
      [
        control.resumen.cantidadEmpleados.toLocaleString('es-AR'),
        `$ ${pesos(control.resumen.remuneracionTotal)}`,
        `$ ${pesos(control.resumen.totalContribuciones)}`,
        `$ ${pesos(control.resumen.totalAportes)}`,
      ],
    ],
  );

  seccion(doc, 'Contribuciones patronales');
  tabla(doc, COLUMNAS_CONCEPTOS, filasConceptos(control.contribuciones, control.resumen.totalContribuciones), { negritaUltima: true });

  seccion(doc, 'Aportes personales');
  tabla(doc, COLUMNAS_CONCEPTOS, filasConceptos(control.aportes, control.resumen.totalAportes), { negritaUltima: true });

  seccion(doc, 'Cruce con Declaración en Línea');
  if (!cruce) {
    parrafo(doc, 'No se importó la nómina de Declaración en Línea de este período.', { color: COLOR.suave });
  } else {
    const r = cruce.resumen;
    tabla(
      doc,
      [
        { titulo: 'Sin diferencias', ancho: 1, alinear: 'right' },
        { titulo: 'Con diferencias', ancho: 1, alinear: 'right' },
        { titulo: 'Solo en el reporte', ancho: 1, alinear: 'right' },
        { titulo: 'Solo en la DDJJ', ancho: 1, alinear: 'right' },
      ],
      [[String(r.sinDiferencias), String(r.conDiferencias), String(r.soloEnReporte), String(r.soloEnDDJJ)]],
    );
    if (r.remuneracionTotalPorRedondeo > 0) {
      parrafo(
        doc,
        `No se listan ${r.remuneracionTotalPorRedondeo} diferencias de centavos en la Remuneración Total: están solo en los conceptos no remunerativos de la DDJJ (redondeo) y la parte remunerativa coincide.`,
        { color: COLOR.suave, tamano: 8 },
      );
    }
    if (r.pasantesConSCVO > 0) {
      parrafo(doc, `${r.pasantesConSCVO} pasante(s) declarados con cobertura de SCVO: la pasantía (Ley 26.427) no lleva SCVO.`, {
        color: COLOR.severidad.alta,
        tamano: 8,
      });
    }
    doc.moveDown(0.5);
    if (cruce.empleados.length === 0) {
      parrafo(doc, 'El reporte y la DDJJ coinciden en todos los CUIL.', { color: COLOR.severidad.baja });
    } else {
      tabla(
        doc,
        [
          { titulo: 'Empleado', ancho: 24 },
          { titulo: 'Tipo', ancho: 10 },
          { titulo: 'Concepto', ancho: 30 },
          { titulo: 'Sistema / App', ancho: 12, alinear: 'right' },
          { titulo: 'DDJJ', ancho: 12, alinear: 'right' },
          { titulo: 'Diferencia', ancho: 12, alinear: 'right' },
        ],
        cruce.empleados.flatMap((e) =>
          e.diferencias.map((x, i) => [
            i === 0 ? `${e.nombre}\nCUIL ${e.cuil}${e.legajo ? ` · leg. ${e.legajo}` : ''}` : '',
            GRUPO_DIFERENCIA[x.grupo] ?? x.grupo,
            x.detalle ? `${x.concepto}\n${x.detalle}` : x.concepto,
            typeof x.valorSistema === 'number' ? pesos(x.valorSistema) : x.valorSistema ?? '—',
            typeof x.valorDDJJ === 'number' ? pesos(x.valorDDJJ) : x.valorDDJJ ?? '—',
            x.diferencia === null ? '—' : pesos(x.diferencia),
          ]),
        ),
        { continuarPrimeraColumna: true },
      );
    }
    // Solo conceptos con diferencias por empleado: un total con centavos sin diferencias por empleado es redondeo.
    const totales = cruce.totalesImportes.filter((t) => t.empleadosConDiferencia > 0);
    if (totales.length > 0) {
      tabla(
        doc,
        [
          { titulo: 'Totales por concepto con diferencia', ancho: 40 },
          { titulo: 'App', ancho: 20, alinear: 'right' },
          { titulo: 'DDJJ', ancho: 20, alinear: 'right' },
          { titulo: 'Diferencia', ancho: 20, alinear: 'right' },
        ],
        totales.map((t) => [t.concepto, pesos(t.app), pesos(t.ddjj), pesos(t.diferencia)]),
      );
    }
  }

  seccion(doc, 'Observaciones del control');
  if (control.observaciones.length === 0) parrafo(doc, 'Sin observaciones.', { color: COLOR.suave });
  for (const o of control.observaciones) {
    if (doc.y > doc.page.height - doc.page.margins.bottom - 60) doc.addPage();
    parrafo(doc, `[${o.severidad.toUpperCase()}] ${o.titulo} · ${o.empleados.length} empleado(s)`, {
      negrita: true,
      color: COLOR.severidad[o.severidad] ?? COLOR.texto,
    });
    parrafo(doc, o.detalle);
    parrafo(doc, o.empleados.map((e) => `${e.nombre} (leg. ${e.legajo})`).join(' · '), { color: COLOR.suave, tamano: 7.5 });
    doc.moveDown(0.5);
  }

  seccion(doc, 'Empleados por modalidad de contratación');
  tabla(
    doc,
    [
      { titulo: 'Código', ancho: 8 },
      { titulo: 'Modalidad', ancho: 38 },
      { titulo: 'Empleados', ancho: 10, alinear: 'right' },
      { titulo: 'Qué se calcula', ancho: 44 },
    ],
    control.modalidades.map((m) => [m.codigo, m.descripcion ?? 'Fuera del catálogo', String(m.cantidadEmpleados), m.tratamiento]),
  );
  parrafo(doc, 'El detalle por empleado (bases, aportes y contribuciones de cada uno) está en el informe CSV.', {
    color: COLOR.suave,
    tamano: 8,
  });

  // Pie con número de página
  const rango = doc.bufferedPageRange();
  for (let i = rango.start; i < rango.start + rango.count; i++) {
    doc.switchToPage(i);
    // Sin margen inferior mientras se escribe el pie: si no, pdfkit agrega una página en blanco.
    const margenInferior = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    const y = doc.page.height - 28;
    doc
      .font('Helvetica')
      .fontSize(7.5)
      .fillColor(COLOR.suave)
      .text(`${d.cliente.razonSocial} · Control de Leyes ${nombrePeriodo(d.periodo)} · Página ${i + 1} de ${rango.count}`, 40, y, {
        width: ancho - 80,
        align: 'center',
        lineBreak: false,
      });
    doc.page.margins.bottom = margenInferior;
  }

  doc.end();
  return fin;
}
