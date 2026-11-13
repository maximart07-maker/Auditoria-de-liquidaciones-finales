# Control de Nómina — guía para Claude

App del estudio para auditar nómina y liquidaciones de sueldos bajo legislación argentina. Monorepo:

- `packages/motor-calculo` — lógica pura de cálculo (`@audit/motor-calculo`), con tests (vitest). Las reglas de negocio viven acá.
- `apps/api` — NestJS + Prisma (PostgreSQL). Importa archivos, guarda datos, expone el panel y los informes.
- `apps/web` — Next.js (App Router) + Tailwind, paleta Crowe (`crowe-indigo`, `crowe-magenta`, etc. en `tailwind.config.ts`).

La documentación de reglas está en `docs/motor-calculo.md` (§10 Cargas sociales, §11 Nómina mensual › Control de Leyes). Mantenela al día con cada cambio de reglas.

## Quién la usa y cómo hablarle

- Los usuarios son contadores/auditores, **no programadores**, en Windows. Respondé en español rioplatense, simple, sin jerga técnica; cuando haya que tocar la terminal, pasos numerados y comandos exactos.
- En su PC la app se usa con doble clic: `actualizar.cmd` (baja `main`, instala dependencias, compila el motor y aplica migraciones con `prisma migrate deploy`) e `iniciar.cmd` (Docker + API + web). Necesitan Docker Desktop abierto.
- `actualizar.cmd` solo trae lo que está en `main`: un cambio que quedó en una rama o en un PR sin unir **no lo ven**.

## Forma de trabajar

- Cambios en una rama → PR a `main` → el usuario lo une (o pide que lo unas). Después: `actualizar.cmd` + `iniciar.cmd`.
- Cambios de base de datos: migración nueva en `apps/api/prisma/migrations/<fecha>_<nombre>/migration.sql` (se puede generar con `prisma migrate diff` entre el schema anterior y el nuevo). Nunca editar migraciones ya unidas.
- Antes de subir: `npx vitest run` en `packages/motor-calculo`, `npx tsc --noEmit -p .` en `apps/api` y `apps/web`, y `npx next build` en `apps/web`. Si cambia el motor, `npm run build --workspace packages/motor-calculo` antes de probar la API.
- Estilo: comillas simples, sin correr prettier sobre archivos enteros (reformatea todo con otra configuración). Textos de la interfaz en español.
- **Datos personales:** los archivos que suben los usuarios (reportes, nóminas de DDJJ) tienen nombres y CUIL reales. **No** los copies al repositorio ni a los tests: los fixtures usan datos inventados.
- **No inventar reglas legales ni alícuotas.** Si algo no está confirmado acá o en `docs/motor-calculo.md`, preguntale al usuario. Desde el entorno en la nube el sitio de ARCA está bloqueado.

## Nómina mensual › Control de Leyes (reglas confirmadas por el usuario)

Ruta: `/clientes/:id/nomina-mensual/control-de-leyes`. Código: `packages/motor-calculo/src/control-f931.ts`, `cruce-ddjj.ts`, `modalidades-contratacion.ts`; API `apps/api/src/nomina-mensual/`.

**Reporte del sistema de liquidación** (CSV `;`, Windows-1252, montos `15.810.040,15`, período `sept-26`): un renglón por empleado con Contrato, Condición SIJP, Remuneración Total, Rem. 1, 2, 3, 4, 5, 8, 9, 10 y montos a detraer. Se guarda uno por período (reimportar reemplaza). **Rem. 3 no se usa** en ningún cálculo (opcional).

**Contribuciones** (alícuotas de *Cargas sociales* del cliente, sobre las bases del reporte, por empleado):

| Concepto | Base | Gran empresa | PyME |
|---|---|---|---|
| SIPA | Rem. 10 | 12,35 % | 10,77 % |
| INSSJP | Rem. 10 | 1,80 % | 1,59 % |
| FNE | Rem. 10 | 1,11 % | 0,94 % |
| Asignaciones familiares | Rem. 10 | 5,14 % | 4,70 % |
| Obra social | Rem. 8 | 5,10 % | 5,10 % |
| FSR | Rem. 8 | 0,90 % | 0,90 % |
| FAL (si aplica) | Rem. 10 | 1 % | 2,5 % |
| ART | Rem. 9 | % del cliente + cuota fija | ídem |
| SCVO | — | monto fijo por empleado | ídem |

Total SUSS: 20,40 % (gran empresa) / 18 % (PyME). El adicional de régimen diferencial se suma a SIPA. Sin detracción configurada, SUSS y FAL van sobre Rem. 2. El FSR es el 15 % de la obra social (aportes y contribuciones).

**Aportes:** SIPA 11 % (Rem. 1), INSSJP 3 % (Rem. 5), obra social 2,55 % y FSR 0,45 % (Rem. 4).

**Modalidades de contratación** (código sin ceros a la izquierda: `027` = `27`):

| Código | Aportes | Contribuciones |
|---|---|---|
| 027 Pasantías Ley 26.427 | ninguno | obra social (con FSR) y ART — **sin SCVO** (no es relación de dependencia) |
| 049 Director de S.A. con OS y ART | obra social y FSR | obra social, FSR, ART y SCVO |
| 099 Socios, directores o administradores | ninguno | ART y SCVO |
| resto | todos | todos |

Los demás regímenes especiales del catálogo (010, 051, 002, 003, 018, 061, 062…) se calculan como régimen general y el panel lo avisa; el usuario pidió definirlos **cuando aparezcan**.

**Cruce con Declaración en Línea** (nómina del F.931 presentado, CSV con cabecera CUIT/Período/Secuencia): por CUIL compara presencia, modalidad, Remuneración Total, Rem. 1, 2, 4, 5, 8, 9, 10, detracción e importes de ARCA contra lo calculado por la app. Tolerancia un centavo. Diferencias de Remuneración Total menores a $1 que están solo en "Conceptos no remunerativos" de la DDJJ son redondeo y no se listan. Marca a los pasantes declarados con `Con Cobertura S.C.V.O.? = Si`. Rechaza la nómina si el CUIT no es el del cliente. Con la configuración correcta del cliente, los importes coinciden centavo a centavo con ARCA: si no coinciden, primero revisar *Cargas sociales* del cliente (p.ej. PyME vs gran empresa).

**Informe:** botones PDF (`pdfkit`) y CSV (Excel en español: `;`, coma decimal, UTF-8 con BOM) en `GET /clientes/:id/nomina-mensual/control-de-leyes/informe.pdf|csv?periodo=AAAA-MM`. El detalle por empleado va solo en el CSV.
