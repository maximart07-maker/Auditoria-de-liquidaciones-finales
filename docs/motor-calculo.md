# Motor de Cálculo — Lógica de Negocio y Pseudocódigo

> Implementación de referencia: Ley de Contrato de Trabajo (LCT, Ley 20.744) y leyes complementarias (25.323, 25.345, 25.877). **Este documento es una guía de diseño técnico, no asesoramiento legal**: los porcentajes, topes y plazos deben validarse con un asesor laboral antes de llevar el motor a producción, y deben mantenerse versionados porque cambian por CCT, decreto o jurisprudencia (ej. fallo "Vizzoti" sobre el tope del art. 245).

## 1. Principio de diseño: parámetros normativos versionados

Ninguna fórmula debe tener un número "hardcodeado" que dependa de la ley o el convenio. Todo valor variable se obtiene de una tabla de parámetros vigente **a la fecha de extinción del caso**, no a la fecha de cálculo:

```ts
interface ParametrosNormativos {
  convenioColectivo: string;
  vigenciaDesde: Date;
  vigenciaHasta: Date | null;
  topeIndemnizatorio: number;       // 3x el promedio de convenio (art. 245 LCT)
  divisorSAC: number;               // 12 (histórico) — configurable por si cambia
  divisorVacaciones: number;        // 25 (LCT, para mensualizados)
  diasVacacionesPorAntiguedad: {    // art. 150 LCT
    hasta5Anios: number;            // 14
    de5a10Anios: number;            // 21
    de10a20Anios: number;           // 28
    masDe20Anios: number;           // 35
  };
}

function obtenerParametrosVigentes(convenio: string, fecha: Date): ParametrosNormativos {
  // busca en la tabla de parámetros el registro de `convenio`
  // cuya vigencia incluye `fecha`; error si no hay uno cargado
}
```

## 2. Variables base requeridas (input común a las fórmulas)

```ts
interface VariablesCaso {
  fechaIngreso: Date;
  fechaEgreso: Date;
  tipoExtincion: 'despido_sin_causa' | 'despido_con_causa' | 'renuncia'
               | 'mutuo_acuerdo' | 'vencimiento_contrato' | 'fallecimiento';
  mejorRemuneracionMensualNormalYHabitual: number;  // "MRMNH", base del art. 245 — ver §2.1, no se carga a mano
  mejorRemuneracionSemestral: number;                // base del SAC proporcional (arts. 121-123) — ver §2.1, se deriva por defecto
  sueldoMensualActual: number;                       // base de vacaciones no gozadas — ver §2.1, se deriva por defecto
  diasVacacionesGozadosEnElAnio: number;
  diasVacacionesCorrespondientesManual: number;       // override manual de días anuales, si supera ley/convenio — ver §9 (opcional, default 0)
  diasVacacionesPendientesPeriodosAnteriores: number; // deuda de vacaciones de años anteriores (opcional, default 0)
  preavisoOtorgado: boolean;
  convenioColectivo: string;
}
```

### 2.1 De dónde sale la MRMNH: histórico mensual de remuneraciones

`mejorRemuneracionMensualNormalYHabitual` **no se carga como un número suelto**: el histórico mensual de remuneraciones cuelga del **`Empleado`** (no del `Caso` — ver §2.2, se puede importar en lote antes de que exista ningún caso de desvinculación) y el motor deriva la MRMNH de forma pura, trazable y reproducible con `calcularMRMNH`, siguiendo el art. 245 LCT: el mayor mes remunerativo y habitual devengado durante el **último año trabajado**, o durante el tiempo de prestación de servicios si éste fuera menor a un año.

```ts
interface RemuneracionMensual {
  periodo: Date;                  // primer día del mes
  conceptosRemunerativos: number; // suma de lo remunerativo del mes (excluye lo no remunerativo)
  esNormalYHabitual: boolean;     // false = mes distorsionado (retroactivo, liquidación de vacaciones) — se excluye
}

function calcularMRMNH(remuneraciones: RemuneracionMensual[], fechaIngreso: Date, fechaEgreso: Date): MRMNHCalculada {
  const inicioVentana = maxFecha(fechaIngreso, sumarMeses(fechaEgreso, -12));
  const enVentana = remuneraciones.filter(
    (r) => r.esNormalYHabitual && r.periodo >= inicioVentana && r.periodo <= fechaEgreso,
  );
  if (enVentana.length === 0) throw new SinRemuneracionesError();

  const mejor = enVentana.reduce((max, r) => (r.conceptosRemunerativos > max.conceptosRemunerativos ? r : max));
  return { valor: mejor.conceptosRemunerativos, periodoSeleccionado: mejor.periodo, mesesConsiderados: enVentana.length, detalle: {...} };
}
```

`AuditoriasService.ejecutar()` llama a `calcularMRMNH` con el histórico del **empleado** del caso (`caso.empleado.remuneracionesMensuales`) antes de armar el resto de `VariablesCaso`; si no hay ningún mes normal/habitual dentro de la ventana, devuelve 400 con un mensaje claro para el auditor en vez de dejar auditar con un dato faltante. Es obligatorio: sin al menos un mes cargado para ese empleado, la auditoría no puede ejecutarse.

`sueldoMensualActual` (base de `VAC_NO_GOZADAS`/`VAC_NO_GOZADAS_ANTERIORES`, §4.5-4.6) tampoco se carga como un número suelto por defecto: `AuditoriasService.sueldoBaseIndemnizacionDelCaso` toma el `conceptosRemunerativos` de la `RemuneracionMensual` más reciente hasta el mes de egreso inclusive — que ya viene filtrada por el catálogo de conceptos del cliente cuando existe (§2.4), a diferencia de la MRMNH acá no importa si el mes es "normal y habitual" (es la remuneración vigente al momento de la extinción, no la mejor del año). Una variable manual `sueldoMensualActual` cargada por el auditor tiene prioridad sobre este valor derivado; solo hace falta cargarla a mano si el empleado no tiene ninguna `RemuneracionMensual` importada hasta esa fecha.

`mejorRemuneracionSemestral` (base de `SAC_PROP`, §4.4) tampoco es un número suelto por defecto, y **no es la misma ventana que la MRMNH**: los arts. 121 a 123 LCT (según el método de cálculo de la Ley 23.041 y su Decreto reglamentario 1078/1984) fijan el SAC como la mejor remuneración devengada **dentro del semestre calendario** (ene-jun o jul-dic) que contiene el egreso, prorrateada por los días trabajados — no de los últimos 12 meses, como el art. 245. `calcularBaseSAC` (`packages/motor-calculo/src/sac-base.ts`) filtra el histórico de `RemuneracionMensual` del empleado a ese semestre (y sigue exigiendo `esNormalYHabitual`) y toma la mejor; `AuditoriasService.baseSACDelCaso` la deriva por defecto. Una variable manual `mejorRemuneracionSemestral` tiene prioridad; solo hace falta cargarla a mano si no hay ninguna remuneración normal y habitual importada dentro de ese semestre.

Esta base **tampoco es `conceptosRemunerativos`** (la del art. 245): usa el campo propio `RemuneracionMensual.remuneracionDevengadaSac`, con un criterio de neteo distinto. El art. 245 quiere el sueldo "normal" del mes (por eso, para un mes parcial, se excluyen los descuentos por días no trabajados — ver §2.3, el mes sigue compitiendo por ser la MRMNH con su valor pleno). El SAC, en cambio, se calcula sobre lo **efectivamente devengado** ese mes (arts. 121/122: "remuneración... devengada"): si el empleado trabajó la mitad del mes, la remuneración devengada de ese mes es la mitad, no el sueldo pleno. Por eso `remuneracionDevengadaSac` sí netea esos descuentos, y además excluye el propio concepto de SAC proporcional del recibo (evita circularidad: no se puede usar el SAC ya liquidado para calcular la base del próximo cálculo de SAC). Ver §2.3 para cómo se deriva.

### 2.2 Import masivo de nómina

Cargar mes a mes a mano no escala para una plantilla de cientos de empleados. `POST /clientes/:clienteId/importaciones/nomina` (`apps/api/src/importaciones/`) acepta un `.xlsx` con un **renglón por concepto liquidado, por empleado y período** — el formato típico de export de un sistema de liquidación de sueldos:

| Columna | Uso |
|---|---|
| `Doc` | CUIL del empleado (se normaliza sacando guiones/espacios; es la clave de matching contra `Empleado.cuil`) |
| `Apellido y Nombre` | Nombre, para dar de alta el `Empleado` si el CUIL no existe todavía en el cliente |
| `Período` | Mes al que corresponde el concepto (se normaliza al día 1) |
| `Ingreso` | Fecha de ingreso, para el alta automática del `Empleado` |
| `Categoría` | Categoría/puesto, para el alta automática del `Empleado` |
| `Proceso` | Nombre del proceso de liquidación — si contiene "ajuste" (retroactivo), el mes se marca `esNormalYHabitual=false` |
| `Código` | Código de concepto del sistema de nómina del cliente. Si el cliente importó su catálogo (§2.4), se usa `ConceptoCliente.baseIndemnizacion`/`tipo` para decidir si el concepto suma a `conceptosRemunerativos`/`remuneracionDevengadaSac`; si el código no está en el catálogo (o el cliente no importó ninguno), se cae al `TIPO` de la fila como antes |
| `Concepto`, `Monto`, `TIPO` | Se agrupan por empleado+período: por defecto (sin catálogo) `TIPO='REMU'` suma a `conceptosRemunerativos` y a `remuneracionDevengadaSac` (salvo que el nombre del concepto matchee un rubro de liquidación final vía `rubroParaConcepto`, p.ej. el propio SAC — ver §2.1), cualquier otro valor suma a `conceptosNoRemunerativos` (informativo, no entra en ninguna base); el desglose por concepto queda en `RemuneracionMensual.detalle` para trazabilidad |

`Empleado`, `Modelo`, `Depto.`, `Tipo` y `Contrato` no se usan (no tienen un campo equivalente en el modelo hoy). El resto de columnas (`Doc`, `Apellido y Nombre`, `Período`, `Ingreso`, `Categoría`, `Proceso`, `Código`, `Concepto`, `Monto`, `TIPO`) son obligatorias — el import rechaza el archivo si falta alguna. La importación es **idempotente**: reimportar el mismo archivo actualiza (no duplica) los mismos `Empleado`/`RemuneracionMensual` vía upsert por `[clienteId, cuil]` / `[empleadoId, periodo]`.

### 2.3 Import del recibo de liquidación final (crea el caso)

`POST /clientes/:clienteId/importaciones/recibo` (`apps/api/src/importaciones/recibo-liquidacion.parser.ts`) parsea el **recibo de sueldo en PDF** que el sistema de liquidación emite para la liquidación final — el mismo formato estándar de recibo de haberes (encabezado con datos de la empresa y del legajo, tabla de conceptos liquidados) que ya usan varios proveedores de nómina argentinos. A diferencia del import de nómina (§2.2), este da de alta **el `Empleado` y crea el `Caso`** en un solo paso:

- **Empleado**: CUIL, nombre, categoría y fecha de ingreso salen del encabezado del recibo; se da de alta si el CUIL no existe todavía en el cliente (mismo criterio que §2.2).
- **Caso**: el recibo **no trae** el motivo ni la fecha de extinción (no son datos de nómina — viven en el telegrama/acuerdo de desvinculación) — el formulario los pide aparte, con un desplegable para el motivo y una fecha, ambos completables a mano.
- **`RemuneracionMensual`** del período del recibo: `conceptosRemunerativos` se calcula sumando, código por código, los conceptos del recibo cuyo `ConceptoCliente.baseIndemnizacion` es `true` (§2.4) — si el cliente todavía no importó su catálogo, se cae al total "Remunerativo" que imprime el recibo (menos preciso: puede incluir conceptos remunerativos que la doctrina excluye de la base del art. 245, como el SAC proporcional). La respuesta del import (`baseCalculadaConCatalogo`) indica cuál de los dos se usó.

  `esNormalYHabitual` sigue el mismo criterio: **con catálogo**, se asume `true` — los conceptos de ajuste por mes parcial (días/horas no trabajados, descuento por ingreso/egreso — típicos de una liquidación final con fecha de egreso mid-mes) normalmente no están marcados `baseIndemnizacion=true` en el catálogo, así que `conceptosRemunerativos` ya queda depurado de esa distorsión y el mes sí es representativo para competir por la MRMNH (p.ej. una renuncia el 15 del mes: el SAC proporcional y los descuentos de días son mecánica normal de liquidación final, no bajan el sueldo básico que entra en la base). **Sin catálogo**, en cambio, `conceptosRemunerativos` es el total "Remunerativo" impreso —que si incluye esos conceptos de ajuste sí distorsiona el mes— y se seguía marcando `esNormalYHabitual=false` si el recibo trae alguno de esos conceptos (igual criterio que el "ajuste" de §2.2).

  `remuneracionDevengadaSac` (base del SAC, §2.1) se calcula distinto — acá sí importa netear el mes parcial, porque el SAC se calcula sobre lo devengado: **con catálogo**, suma los conceptos del recibo cuyo `ConceptoCliente.tipo` es `remunerativo` y cuyo nombre no matchea ningún rubro de liquidación final (`rubroParaConcepto` — excluye el propio SAC proporcional, las vacaciones no gozadas y sus SAC). Para el ejemplo de la renuncia el 15 del mes: Sueldo Básico (+100%) + Licencia Enfermedad (+50%) − Días no trabajados (−50%) − Descuento ingreso/egreso (−50%) = 50% del sueldo básico — exactamente la mitad del mes trabajada, a diferencia de `conceptosRemunerativos` que da el 100% (el sueldo "normal", para el art. 245). **Sin catálogo**, cae al total "Remunerativo" impreso del recibo menos el monto del concepto de SAC proporcional detectado por nombre (el total impreso ya suele netear los descuentos por mes parcial).
- **`Liquidacion` de origen "empresa"**: se cargan los rubros que el recibo sí trae, mapeados por **palabras clave en el nombre del concepto** (no por código — los códigos son específicos del proveedor de nómina, no un estándar): "sac" + "proporcional" → `SAC_PROP`; "vac" + "no goz" (sin "anterior") → `VAC_NO_GOZADAS`; "vac" + "no goz" + "anterior" → `VAC_NO_GOZADAS_ANTERIORES`; con "sac" antepuesto, los mismos dos casos → `SAC_S_VAC` / `SAC_S_VAC_ANTERIORES`. **El recibo de liquidación final típicamente no incluye la indemnización por antigüedad, el preaviso ni la integración del mes** (se liquidan por otro instrumento) — quedan declarados en $0, que es justamente la señal que la auditoría necesita marcar si esos rubros se pagaron por fuera del recibo.
- **`VariableCaso` `diasVacacionesPendientesPeriodosAnteriores`** (art. 156 LCT, §4.6): a diferencia de los días del año en curso (que el motor recalcula de forma independiente por antigüedad — art. 150, no hay margen para "copiar" el número de la empresa sin perder la independencia de la auditoría), la deuda de vacaciones de años anteriores **no tiene una fórmula legal**: es un dato histórico de lo que la empresa nunca otorgó ni compensó, así que no hay nada que auditar en el número en sí (sí en el `valorDia` que se le aplique). El recibo trae ese dato en la `unidad` del concepto "Vac No Gozadas Anterior" — si está presente, se autocompleta como esta variable (`fuente: 'importado'`), en vez de dejarla en 0 por defecto y forzar al auditor a cargarla a mano. El import devuelve `diasVacacionesPendientesPeriodosAnteriores` (o `null` si el recibo no trae ese concepto con unidad) para que la UI lo muestre.

No es idempotente: reimportar el mismo recibo crea un `Caso` nuevo cada vez (no hay forma de saber, solo con el PDF, si dos importaciones corresponden al mismo trámite de baja).

### 2.4 Catálogo de conceptos del cliente (base del art. 245)

Los códigos de concepto **no son un estándar**: cada cliente (o su proveedor de liquidación de sueldos) numera distinto, y un mismo código puede significar cosas distintas entre clientes. Además, que un concepto sea remunerativo no alcanza para saber si entra en la base del art. 245 LCT (MRMNH): el SAC proporcional, por ejemplo, es remunerativo pero la doctrina lo excluye de esa base. `POST /clientes/:clienteId/importaciones/conceptos` (`apps/api/src/importaciones/conceptos-cliente.parser.ts`) importa el catálogo propio de cada cliente para resolver esto sin adivinar, un `.xlsx` (hoja "Conceptos") con:

| Columna | Uso |
|---|---|
| `Código` | Código de concepto del cliente. Se normaliza como número (`"01100"` y `1100` matchean) para poder cruzar contra el código de nómina (§2.2) y el del recibo (§2.3), que lo traen con formato distinto |
| `Descripción` | Nombre del concepto, informativo |
| `Tipo` | `Remunerativo` / `No remunerativo` / `Descuento` — se guarda en `ConceptoCliente.tipo`. No decide la base del art. 245 (ver `Base Indemnización`), pero sí decide la base del SAC proporcional (`remuneracionDevengadaSac`, §2.1/§2.3): solo los conceptos marcados `Remunerativo` cuentan, sin importar el signo del monto (un descuento por mes parcial también es `Remunerativo`, reduce lo devengado) |
| `Característica` | `Fijo` / `Variable` / vacío (`N/A`) — informativo |
| `Base Indemnización` | `Si`/`No` — **la señal que efectivamente usan los importadores**: si el concepto suma a `conceptosRemunerativos` (§2.2, §2.4) |

Si un cliente no importa su catálogo, ambos importadores siguen funcionando con su criterio anterior (el `TIPO` de la fila en la nómina, el total "Remunerativo" impreso en el recibo) — el catálogo es una mejora opcional pero recomendada, y conviene cargarlo antes de importar nómina o recibos de ese cliente para que la base quede bien calculada desde el primer import. La importación es **idempotente**: reimportar actualiza (no duplica) el catálogo vía upsert por `[clienteId, codigo]`.

## 3. Rubros aplicables según tipo de extinción

El motor no calcula "todos los rubros siempre": primero resuelve qué rubros corresponden al `tipo_extincion` del caso.

| Rubro | despido_sin_causa | despido_con_causa | renuncia | mutuo_acuerdo (art. 241) | vencimiento_contrato |
|---|:---:|:---:|:---:|:---:|:---:|
| Indemnización antigüedad | ✅ | ❌ | ❌ | ❌ (salvo pacto) | ❌ |
| Preaviso / sustitutiva | ✅ | ❌ | ❌ (a cargo del trabajador si no preavisa) | ❌ | ❌ |
| Integración mes de despido | ✅ | ❌ | ❌ | ❌ | ❌ |
| SAC proporcional | ✅ | ✅ | ✅ | ✅ | ✅ |
| Vacaciones no gozadas (año en curso) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Vacaciones no gozadas de períodos anteriores | ✅ | ✅ | ✅ | ✅ | ✅ |
| SAC s/vacaciones no gozadas (año en curso) | ✅ | ✅ | ✅ | ✅ | ✅ |
| SAC s/vacaciones no gozadas de períodos anteriores | ✅ | ✅ | ✅ | ✅ | ✅ |

> Las multas de la Ley 25.323 (arts. 1 y 2) y del art. 80 LCT se dieron de baja del motor de cálculo — ver nota al final de §4.

```ts
function rubrosAplicables(tipoExtincion: string): string[] {
  const base = ['SAC_PROP', 'VAC_NO_GOZADAS', 'VAC_NO_GOZADAS_ANTERIORES', 'SAC_S_VAC', 'SAC_S_VAC_ANTERIORES'];
  if (tipoExtincion === 'despido_sin_causa') {
    return [...base, 'IND_ANTIGUEDAD', 'PREAVISO', 'INTEGRACION_MES'];
  }
  return base;
}
```

## 4. Fórmulas

### 4.1 Indemnización por antigüedad (art. 245 LCT)

```
antigüedadEnAnios = añosCompletos(fechaIngreso, fechaEgreso)
                     + (fracciónMayorA3Meses ? 1 : 0)   // fracción > 3 meses se computa como año completo

baseCalculo = min(MRMNH, topeIndemnizatorio)

// piso: si el tope hace que la indemnización sea menor a un mes de sueldo, se usa un mes de sueldo
// (doctrina posterior a "Vizzoti", que además limita la quita del tope al 33% del MRMNH real)
if (baseCalculo < MRMNH * 0.67) {
    baseCalculo = MRMNH * 0.67
}

indemnizacionAntiguedad = baseCalculo * max(antigüedadEnAnios, 1)  // mínimo 1 mes de antigüedad
```

```ts
function calcularIndemnizacionAntiguedad(v: VariablesCaso, p: ParametrosNormativos): RubroCalculado {
  const anios = aniosConFraccion(v.fechaIngreso, v.fechaEgreso);
  let base = Math.min(v.mejorRemuneracionMensualNormalYHabitual, p.topeIndemnizatorio);
  const piso = v.mejorRemuneracionMensualNormalYHabitual * 0.67; // tope "Vizzoti"
  if (base < piso) base = piso;
  const monto = base * Math.max(anios, 1);
  return { rubro: 'IND_ANTIGUEDAD', monto, detalle: { anios, base, piso, tope: p.topeIndemnizatorio } };
}
```

### 4.2 Preaviso / indemnización sustitutiva (arts. 231/232 LCT)

```
si preavisoOtorgado == true:
    montoPreaviso = 0   // ya fue cumplido en especie, no corresponde indemnizar
si antigüedad < 5 años:
    mesesPreaviso = 1
sino:
    mesesPreaviso = 2

montoPreaviso = mesesPreaviso * MRMNH
montoPreaviso += SAC sobre ese monto (montoPreaviso / 12)   // el preaviso "se integra" con SAC
```

### 4.3 Integración del mes de despido (art. 233 LCT)

```
si el despido no ocurre el último día calendario del mes:
    diasRestantesDelMes = diasEnElMes(fechaEgreso) - diaDelMes(fechaEgreso)
    integracionMes = (MRMNH / diasEnElMes(fechaEgreso)) * diasRestantesDelMes
    integracionMes += SAC sobre ese monto (integracionMes / 12)
sino:
    integracionMes = 0
```

### 4.4 SAC proporcional (aguinaldo, arts. 121 a 123 LCT y Ley 23.041)

`mejorRemuneracionDelSemestre` es `mejorRemuneracionSemestral` — la mejor `remuneracionDevengadaSac` **dentro del semestre calendario del egreso** (no `conceptosRemunerativos`, y no la MRMNH del art. 245 de los últimos 12 meses) — ver §2.1 y `calcularBaseSAC`.

Se computa bajo la **convención comercial** (mes de 30 días, año de 360 — variante 30E/360), no con días calendario reales: cada semestre equivale siempre a 180 días, sin importar meses de 28 a 31 días ni años bisiestos. El divisor de la proporción es **360 (el año)**, no 180 (el semestre): con el semestre completo trabajado (180 días), `diasTrabajados/360 = 0,5` — el 50% de `mejorRemuneracionDelSemestre`, nunca el 100% (el año completo, con sus dos cuotas semestrales, es el que suma una remuneración entera).

```
semestre = obtenerSemestre(fechaEgreso)               // 1/1–30/6 o 1/7–31/12
diasTrabajadosEnSemestre = diasEntreComercial(inicioSemestre o fechaIngreso (lo que sea posterior), fechaEgreso)
diasDelAnio = 360

sacProporcional = mejorRemuneracionDelSemestre * (diasTrabajadosEnSemestre / diasDelAnio)
```

```ts
// mes de 30 días / año de 360 (30E/360): el día 31 se trata como 30 en ambas puntas
function diasEntreComercial(desde: Date, hasta: Date): number {
  const anios = hasta.getUTCFullYear() - desde.getUTCFullYear();
  const meses = hasta.getUTCMonth() - desde.getUTCMonth();
  const diaDesde = Math.min(desde.getUTCDate(), 30);
  const diaHasta = Math.min(hasta.getUTCDate(), 30);
  return anios * 360 + meses * 30 + (diaHasta - diaDesde);
}

const DIAS_DEL_ANIO = 360;

function calcularSACProporcional(v: VariablesCaso): RubroCalculado {
  const { inicio, fin } = semestreDe(v.fechaEgreso);
  const desde = maxFecha(inicio, v.fechaIngreso);
  const diasTrabajados = diasEntreComercial(desde, v.fechaEgreso) + 1;
  const monto = v.mejorRemuneracionSemestral * (diasTrabajados / DIAS_DEL_ANIO);
  return { rubro: 'SAC_PROP', monto, detalle: { diasTrabajados, diasDelAnio: DIAS_DEL_ANIO, convencion: '30/360' } };
}
```

### 4.5 Vacaciones no gozadas (art. 150 y 156 LCT)

`sueldoMensualActual` se deriva por defecto de la `RemuneracionMensual` filtrada por el catálogo del cliente — ver §2.1.

La antigüedad para el tramo de días **no** es la antigüedad real a `fechaEgreso`: el art. 150 LCT manda explícitamente "para determinar la extensión de las vacaciones atendiendo a la antigüedad en el empleo, se computará como tal aquélla que tendría el trabajador al 31 de diciembre del año que correspondan las mismas" — es decir, la antigüedad proyectada al 31/12 del año de la extinción (`aniosCompletos(fechaIngreso, finDelAnio(fechaEgreso))`), sin importar que el contrato termine antes. Un trabajador que se va en enero, antes de cumplir años, igual puede computar el año que cumpliría en diciembre si ya no queda margen para que la empresa se lo reconozca de otra forma. Tampoco usa `aniosConFraccion` (la regla de "fracción mayor a 3 meses cuenta año entero"): esa es específica del art. 245 (indemnización por antigüedad), no del art. 150 — acá los años completos se cuentan sin redondeo, solo proyectados al fin de año.

Los días anuales que corresponden son el **mayor** entre tres fuentes — piso legal, tabla del convenio/cliente y el valor manual del caso, si lo hay (§9) — nunca el menor: ninguna de las personalizaciones puede *bajar* lo que corresponde por ley.

```
antigüedadParaTramo = aniosCompletos(fechaIngreso, finDelAnio(fechaEgreso))  // art. 150: antigüedad proyectada al 31/12, no a fechaEgreso

diasSegunLey = segunTablaAntiguedad(antigüedadParaTramo, DIAS_VACACIONES_LCT)          // piso, art. 150 LCT
diasSegunConvenio = segunTablaAntiguedad(antigüedadParaTramo, parametros.diasVacacionesPorAntiguedad)  // convenio/cliente, §9
diasSegunLeyOConvenio = max(diasSegunLey, diasSegunConvenio)
diasAnuales = max(diasSegunLeyOConvenio, diasVacacionesCorrespondientesManual)  // override manual del caso, §9 — 0 si no se cargó

// proporcional a meses trabajados en el año calendario de la extinción
mesesTrabajadosEnElAnio = mesesCompletos(inicioDelAnio o fechaIngreso, fechaEgreso)
diasProporcionales = round(diasAnuales / 12 * mesesTrabajadosEnElAnio)
diasNoGozados = diasProporcionales - diasVacacionesGozadosEnElAnio

valorDia = sueldoMensualActual / parametros.divisorVacaciones   // divisor 25, LCT

vacacionesNoGozadas = max(diasNoGozados, 0) * valorDia
```

### 4.6 Vacaciones no gozadas de períodos anteriores (art. 156 LCT)

Control **aparte** del proporcional del año en curso (§4.5): cubre días de vacaciones de años anteriores que la empresa nunca otorgó ni compensó. Se valúan al mismo valor día, pero el dato de días pendientes lo carga el auditor (manual, o autocompletado a partir de lo liquidado en recibos de sueldo anteriores) — el motor no aplica prescripción (art. 256 LCT) sobre esos días, confía en que ya vienen depurados. Es opcional: si no se cargó ningún valor para el caso, se asume 0 (sin deuda conocida) y no bloquea la auditoría. Devenga SAC con el mismo criterio que el proporcional del año en curso — ver §4.7.

```
valorDia = sueldoMensualActual / parametros.divisorVacaciones   // mismo valor día que §4.5

vacacionesNoGozadasAnteriores = diasVacacionesPendientesPeriodosAnteriores * valorDia
```

```ts
function calcularVacacionesPeriodosAnteriores(v: VariablesCaso, p: ParametrosNormativos): RubroCalculado {
  const valorDia = v.sueldoMensualActual / p.divisorVacaciones;
  const monto = v.diasVacacionesPendientesPeriodosAnteriores * valorDia;
  return { rubro: 'VAC_NO_GOZADAS_ANTERIORES', monto, detalle: { diasPendientes: v.diasVacacionesPendientesPeriodosAnteriores, valorDia } };
}
```

### 4.7 SAC sobre vacaciones no gozadas

Las vacaciones no gozadas integran la base de cálculo del aguinaldo, con el mismo criterio tanto para el proporcional del año en curso (§4.5) como para la deuda de períodos anteriores (§4.6) — cada una liquida su propio rubro (`SAC_S_VAC` / `SAC_S_VAC_ANTERIORES`) para no mezclar ambos controles en la auditoría.

```
sacSobreVacaciones = vacacionesNoGozadas / 12                     // SAC_S_VAC
sacSobreVacacionesAnteriores = vacacionesNoGozadasAnteriores / 12 // SAC_S_VAC_ANTERIORES
```

```ts
function calcularSACSobreVacaciones(vacaciones: RubroCalculado, rubroDestino: CodigoRubro): RubroCalculado {
  const monto = vacaciones.monto / 12;
  return { rubro: rubroDestino, monto, detalle: { montoVacacionesNoGozadas: vacaciones.monto } };
}
```

> **Multas dadas de baja (2026-09-22):** el motor calculaba además las multas del
> art. 2 Ley 25.323 (falta de pago en término), art. 1 Ley 25.323 (registración
> deficiente) y art. 80 LCT (falta de entrega de certificados). Se quitaron del
> motor de cálculo por decisión de producto: `packages/motor-calculo/src/rubros/multas.ts`
> se eliminó, `CodigoRubro` ya no incluye `MULTA_ART2_25323` / `MULTA_ART1_25323` /
> `MULTA_ART80`, y `VariablesCaso` perdió los flags que solo alimentaban esas
> fórmulas (`intimacionPagoCursada`, `intimacionCertificadosCursada`,
> `certificadosEntregados`, `registracionDeficiente`). En la base de datos los
> `Rubro` correspondientes se marcaron `activo=false` (no se borraron, para no
> romper `LiquidacionRubro`/`Hallazgo` de auditorías históricas que ya los
> referencian) — ver `apps/api/prisma/seed.ts`.

## 5. Orquestador del motor

```ts
function calcularLiquidacionSistema(caso: Caso, variables: VariablesCaso): LiquidacionCalculada {
  const parametros = obtenerParametrosVigentes(variables.convenioColectivo, caso.fechaExtincion);
  const rubrosACalcular = rubrosAplicables(caso.tipoExtincion);
  const resultados: RubroCalculado[] = [];

  for (const codigoRubro of rubrosACalcular) {
    const calculadora = REGISTRO_CALCULADORAS[codigoRubro]; // mapa código -> función pura
    const resultado = calculadora(variables, parametros);
    if (resultado.monto > 0) resultados.push(resultado);
  }

  return {
    casoId: caso.id,
    origen: 'sistema',
    fechaCalculo: hoy(),
    rubros: resultados,
    total: sumar(resultados.map(r => r.monto)),
  };
}
```

## 6. Del cálculo a los hallazgos (módulo de comparación)

```ts
function generarHallazgos(liquidacionEmpresa: Liquidacion, liquidacionSistema: LiquidacionCalculada): Hallazgo[] {
  const rubrosUnion = unionDeRubros(liquidacionEmpresa, liquidacionSistema);

  return rubrosUnion.map(rubro => {
    const declarado = montoDeclaradoPara(rubro, liquidacionEmpresa) ?? 0;
    const calculado = montoCalculadoPara(rubro, liquidacionSistema) ?? 0;
    const diferencia = calculado - declarado;
    const porcentaje = declarado !== 0 ? (diferencia / declarado) * 100 : (calculado > 0 ? 100 : 0);

    return {
      rubro,
      montoDeclarado: declarado,
      montoCalculado: calculado,
      diferencia,
      porcentajeDiferencia: porcentaje,
      severidad: clasificarSeveridad(diferencia, porcentaje),
      estado: 'pendiente',
    };
  });
}

function clasificarSeveridad(diferencia: number, porcentaje: number): 'alta' | 'media' | 'baja' {
  const abs = Math.abs(porcentaje);
  if (abs > 10 || Math.abs(diferencia) > UMBRAL_MONTO_ALTA) return 'alta';
  if (abs > 3) return 'media';
  return 'baja';
}
```

## 7. Validación del motor

Cada función de cálculo (`calcularIndemnizacionAntiguedad`, `calcularSACProporcional`, etc.) debe:
- Ser **pura** (mismo input → mismo output, sin acceso a DB/red).
- Tener una suite de tests con casos de ejemplo verificados manualmente por un asesor laboral (incluyendo casos límite: antigüedad menor a 3 meses, despido el último día del mes, sueldo por encima del tope convencional, trabajador con vacaciones ya gozadas parcialmente).
- Versionarse junto con los `ParametrosNormativos`: un cambio de tope o de días de vacaciones no debe requerir tocar la función, solo cargar un nuevo registro de parámetros con su rango de vigencia.

## 8. Próximos pasos

- Definir el catálogo completo de `ParametrosNormativos` por convenio colectivo relevante para los clientes iniciales.
- Sumar reglas específicas de agravantes (ej. art. 178 LCT — despido por embarazo, art. 182 — despido por matrimonio) como rubros opcionales activables por flags del caso, siguiendo el mismo patrón de `REGISTRO_CALCULADORAS`.
- Definir `UMBRAL_MONTO_ALTA` y los cortes de severidad con el equipo legal (valor fijo vs. relativo al sueldo del empleado).

## 9. Configuración de conceptos fijos y variables por cliente

Cada cliente puede tener su propia combinación de conceptos (`Rubro`) a través de `ConfiguracionRubroCliente` (`apps/api/prisma/schema.prisma`), gestionada por `ConfiguracionesRubroService` (`apps/api/src/configuraciones-rubro/`):

- **Conceptos fijos** (`Rubro.esLegal = true`): los 8 rubros del catálogo base (indemnización por antigüedad, preaviso, integración del mes, SAC proporcional, vacaciones no gozadas del año en curso y de períodos anteriores, y el SAC sobre cada una de esas dos). El servicio **rechaza** cualquier intento de desactivarlos, pasarlos a "variable" o asignarles un monto manual — siempre los determina el motor de cálculo. Dos ajustes permitidos, ambos whitelisted en `PARAMETROS_PERMITIDOS_POR_RUBRO`:
  - **IND_ANTIGUEDAD**: el **tope indemnizatorio** propio del convenio del cliente (`parametros.topeIndemnizatorio`), validado por `validarTopeIndemnizatorio` (`packages/motor-calculo/src/validaciones/tope-indemnizatorio.ts`) — debe ser un número positivo. Se inyecta envolviendo el repositorio de parámetros con `conTopeIndemnizatorio` (`packages/motor-calculo/src/parametros.ts`), pero **nunca elude el piso del 67% de la MRMNH** de la doctrina CSJN "Vizzoti": `calcularIndemnizacionAntiguedad` sigue aplicando `Math.max(base, 0.67 * mrmnh)` sobre el resultado, sea cual sea el tope configurado.
  - **VAC_NO_GOZADAS**: la **tabla de días de vacaciones por tramo de antigüedad** que otorga el convenio colectivo aplicable a los empleados de este cliente, cuando mejora el piso legal — cuatro claves independientes (`diasVacacionesHasta5Anios`, `diasVacaciones5a10Anios`, `diasVacaciones10a20Anios`, `diasVacacionesMasDe20Anios`; solo hace falta cargar los tramos que el convenio mejora, el resto sigue en el piso legal), validadas por `validarDiasVacaciones` (número entero positivo). Se inyecta con `conDiasVacacionesPorAntiguedad`. Igual que con el tope, **nunca elude el piso legal**: `calcularVacacionesNoGozadas` siempre toma el mayor entre `DIAS_VACACIONES_LCT` (piso, art. 150 LCT) y lo configurado, tramo por tramo — un valor por debajo del piso legal simplemente se ignora, no hace falta que el cliente lo valide a mano.
    - **Nota de alcance**: esto es una personalización *por cliente*, no un modelado genérino de convenios colectivos (eso vive en `ParametrosNormativos`/`RepositorioParametrosNormativos`, hoy solo con el registro "GENERICO" — ver §8, "Próximos pasos de modelado"). Sirve para el caso común de un cliente cuyos empleados están todos bajo el mismo convenio; si un cliente tiene empleados bajo convenios distintos con tablas de días distintas, hoy no se puede distinguir por empleado — haría falta modelar cada convenio como un `ParametrosNormativos` propio.
  - Además, a nivel de **caso** (no de cliente), el auditor puede cargar `diasVacacionesCorrespondientesManual` en la pestaña Variables: días anuales que el cliente reconoce para ese empleado puntual (p.ej. un beneficio individual por encima de LCT/convenio), opcional. Mismo criterio de piso: `calcularVacacionesNoGozadas` solo lo toma si es *mayor* al máximo entre el piso legal y la tabla de convenio/cliente — si carga un valor menor, se ignora silenciosamente (no hay forma de que este campo *reduzca* lo que corresponde).
- **Conceptos variables** (`Rubro.esLegal = false`): ítems negociados propios del cliente (premios, bonos, gratificaciones no legales) que se dan de alta bajo demanda con un código, nombre y `valorFijo`, sin piso legal.

`AuditoriasService.ejecutar()` resuelve el repositorio de parámetros normativos a usar por cliente (`repositorioParametrosParaCliente`) antes de invocar `calcularLiquidacionSistema`, de modo que la personalización por cliente queda reflejada en cada auditoría sin tocar el motor puro.
