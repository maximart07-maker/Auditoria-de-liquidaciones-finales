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
  sueldoMensualActual: number;                       // para SAC/vacaciones si difiere de MRMNH
  diasVacacionesGozadosEnElAnio: number;
  diasVacacionesPendientesPeriodosAnteriores: number; // deuda de vacaciones de años anteriores (opcional, default 0)
  preavisoOtorgado: boolean;
  convenioColectivo: string;
}
```

### 2.1 De dónde sale la MRMNH: histórico mensual de remuneraciones

`mejorRemuneracionMensualNormalYHabitual` **no se carga como un número suelto**: el auditor carga el histórico mensual de remuneraciones del caso (`RemuneracionMensual` — básico, horas extra, comisiones, premios habituales, etc., manual u OCR de recibos de sueldo) y el motor deriva la MRMNH de forma pura, trazable y reproducible con `calcularMRMNH`, siguiendo el art. 245 LCT: el mayor mes remunerativo y habitual devengado durante el **último año trabajado**, o durante el tiempo de prestación de servicios si éste fuera menor a un año.

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

`AuditoriasService.ejecutar()` llama a `calcularMRMNH` con el histórico cargado para el caso (`RemuneracionMensual`, incluido en la consulta del `Caso`) antes de armar el resto de `VariablesCaso`; si no hay ningún mes normal/habitual dentro de la ventana, devuelve 400 con un mensaje claro para el auditor en vez de dejar auditar con un dato faltante. Es obligatorio: sin al menos un mes cargado, la auditoría no puede ejecutarse.

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

### 4.4 SAC proporcional (aguinaldo, Ley 23.041)

Se computa bajo la **convención comercial** (mes de 30 días, año de 360 — variante 30E/360), no con días calendario reales: cada semestre equivale siempre a 180 días, sin importar meses de 28 a 31 días ni años bisiestos.

```
semestre = obtenerSemestre(fechaEgreso)               // 1/1–30/6 o 1/7–31/12
diasTrabajadosEnSemestre = diasEntreComercial(inicioSemestre o fechaIngreso (lo que sea posterior), fechaEgreso)
diasTotalesSemestre = diasEntreComercial(inicioSemestre, finSemestre)   // siempre 180

sacProporcional = (mejorRemuneracionDelSemestre / 2) * (diasTrabajadosEnSemestre / diasTotalesSemestre)
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

function calcularSACProporcional(v: VariablesCaso): RubroCalculado {
  const { inicio, fin } = semestreDe(v.fechaEgreso);
  const desde = maxFecha(inicio, v.fechaIngreso);
  const diasTrabajados = diasEntreComercial(desde, v.fechaEgreso) + 1;
  const diasTotales = diasEntreComercial(inicio, fin) + 1; // siempre 180
  const monto = (v.mejorRemuneracionMensualNormalYHabitual / 2) * (diasTrabajados / diasTotales);
  return { rubro: 'SAC_PROP', monto, detalle: { diasTrabajados, diasTotales, convencion: '30/360' } };
}
```

### 4.5 Vacaciones no gozadas (art. 150 y 156 LCT)

```
diasPorAntiguedad = segunTablaAntiguedad(antigüedadEnAnios, parametros.diasVacacionesPorAntiguedad)

// proporcional a meses trabajados en el año calendario de la extinción
mesesTrabajadosEnElAnio = mesesCompletos(inicioDelAnio o fechaIngreso, fechaEgreso)
diasProporcionales = round(diasPorAntiguedad / 12 * mesesTrabajadosEnElAnio)
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

- **Conceptos fijos** (`Rubro.esLegal = true`): los 8 rubros del catálogo base (indemnización por antigüedad, preaviso, integración del mes, SAC proporcional, vacaciones no gozadas del año en curso y de períodos anteriores, y el SAC sobre cada una de esas dos). El servicio **rechaza** cualquier intento de desactivarlos, pasarlos a "variable" o asignarles un monto manual — siempre los determina el motor de cálculo.
  - Único ajuste permitido: el **tope indemnizatorio** propio del convenio del cliente (`parametros.topeIndemnizatorio`, whitelisted en `PARAMETROS_PERMITIDOS_POR_RUBRO`), validado por `validarTopeIndemnizatorio` (`packages/motor-calculo/src/validaciones/tope-indemnizatorio.ts`) — debe ser un número positivo.
  - Ese tope se inyecta en el cálculo envolviendo el repositorio de parámetros con `conTopeIndemnizatorio` (`packages/motor-calculo/src/parametros.ts`), pero **nunca elude el piso del 67% de la MRMNH** de la doctrina CSJN "Vizzoti": `calcularIndemnizacionAntiguedad` sigue aplicando `Math.max(base, 0.67 * mrmnh)` sobre el resultado, sea cual sea el tope configurado.
- **Conceptos variables** (`Rubro.esLegal = false`): ítems negociados propios del cliente (premios, bonos, gratificaciones no legales) que se dan de alta bajo demanda con un código, nombre y `valorFijo`, sin piso legal.

`AuditoriasService.ejecutar()` resuelve el repositorio de parámetros normativos a usar por cliente (`repositorioParametrosParaCliente`) antes de invocar `calcularLiquidacionSistema`, de modo que la personalización por cliente queda reflejada en cada auditoría sin tocar el motor puro.
