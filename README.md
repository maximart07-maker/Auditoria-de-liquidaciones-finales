# Auditoría de Liquidaciones Finales

Sistema para el control, comparación y auditoría de liquidaciones finales de sueldos (despidos, renuncias, mutuos acuerdos, etc.) para múltiples clientes, bajo legislación laboral argentina.

Permite gestionar uno o varios clientes en simultáneo, desde una liquidación puntual hasta lotes masivos (despidos masivos, reestructuraciones, auditorías periódicas), comparando **lo liquidado por la empresa** contra **lo calculado por el motor de auditoría** y generando informes de hallazgos.

## Documentación

- [`docs/arquitectura.md`](docs/arquitectura.md) — Propuesta de arquitectura general y stack tecnológico.
- [`docs/modelo-datos.md`](docs/modelo-datos.md) — Modelo de datos (entidades, relaciones, DDL).
- [`docs/flujo-ux.md`](docs/flujo-ux.md) — Flujo de usuario (UX/UI), de la carga de documentos al informe de auditoría.
- [`docs/motor-calculo.md`](docs/motor-calculo.md) — Lógica de negocio y pseudocódigo de las fórmulas de auditoría.

## Estado

- [x] Propuesta de arquitectura general
- [x] Modelo de datos inicial
- [x] Flujo de usuario (UX/UI)
- [x] Motor de cálculo (lógica de negocio y pseudocódigo de fórmulas)
- [x] Scaffolding de backend/frontend

## Estructura del monorepo

```
apps/
  api/    → Backend NestJS + Prisma (PostgreSQL)
  web/    → Frontend Next.js (App Router) + Tailwind
packages/
  motor-calculo/  → Lógica pura de cálculo/auditoría (@audit/motor-calculo), sin dependencias de framework
```

`@audit/motor-calculo` implementa las fórmulas descriptas en `docs/motor-calculo.md` (indemnización por antigüedad, preaviso, integración del mes, SAC proporcional, vacaciones no gozadas) con tests unitarios (`npm run test --workspace packages/motor-calculo`). El backend lo consume en `apps/api/src/auditorias` para generar la `Liquidacion` de origen "sistema" y los `Hallazgo` de cada auditoría.

## Puesta en marcha local

```bash
# 1. Instalar dependencias de todo el monorepo
npm install

# 2. Compilar el paquete de motor de cálculo (apps/api lo consume ya compilado
#    desde node_modules vía workspace; su dist/ no se versiona en git)
npm run build --workspace packages/motor-calculo

# 3. Levantar Postgres/Redis/MinIO
docker compose up -d

# 4. Configurar variables de entorno
cp .env.example apps/api/.env
cp .env.example apps/web/.env.local   # solo necesita NEXT_PUBLIC_API_URL

# 5. Aplicar el schema de Prisma y cargar el catálogo de rubros
npm run prisma:migrate --workspace apps/api
npm run prisma:seed --workspace apps/api

# 6. Levantar backend y frontend (en dos terminales)
npm run dev:api   # http://localhost:3001
npm run dev:web   # http://localhost:3000
```

Si después modificás algo dentro de `packages/motor-calculo`, hay que repetir el paso 2 (`npm run build --workspace packages/motor-calculo`) y reiniciar `npm run dev:api` para que el backend vea el cambio — el watch de `nest start` no recompila ese paquete externo.

Con la API sin datos, `/` mostrará "sin clientes cargados" — se puede crear el primer cliente con `POST /clientes` (ver `apps/api/src/clientes`).

### Pendiente de implementación (fuera del alcance del scaffolding)

- Worker de OCR/parsing (BullMQ + Textract/Document Intelligence) que procese los `Documento` en estado `pendiente`.
- Generación real de informes PDF (`Informe`).
- Autenticación/RBAC (JWT) — los endpoints hoy no están protegidos.
- Import masivo de nómina para alta de `Lote` (el import de `.xlsx` a `Empleado`/`RemuneracionMensual` ya está — ver `POST /clientes/:clienteId/importaciones/nomina`, docs/motor-calculo.md §2.2).
