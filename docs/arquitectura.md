# Propuesta de Arquitectura General

## 1. Enfoque

El sistema se modela como una aplicación multi-cliente (no necesariamente multi-tenant a nivel infraestructura: un mismo estudio/auditor opera sobre varios `Cliente`s dentro de la misma base). El dominio central es el **Caso** (una extinción laboral a auditar), que puede vivir solo o agrupado en un **Lote** (despido masivo).

Tres preocupaciones se mantienen desacopladas a propósito, porque cambian a ritmos distintos:

1. **Ingesta de datos** (documentos, OCR, carga manual) — variable y propensa a errores de origen externo.
2. **Motor de cálculo** — reglas legales, debe ser puro, versionable y testeable sin tocar la capa web.
3. **Comparación / auditoría** — orquesta 1 y 2, y produce hallazgos e informes.

```
┌─────────────────────────┐      ┌──────────────────────────┐
│        Frontend         │      │      Backend (API)        │
│  Next.js + React        │◄────►│  NestJS (TypeScript)      │
│  - Gestión clientes/casos│      │  - Auth/RBAC              │
│  - Carga de documentos   │      │  - Clientes/Empleados/Casos│
│  - Dashboard comparativo │      │  - Documentos              │
│  - Informes              │      │  - Auditorías              │
└─────────────────────────┘      └──────────┬───────────────┘
                                             │
                     ┌───────────────────────┼───────────────────────┐
                     ▼                       ▼                       ▼
          ┌──────────────────┐   ┌───────────────────┐   ┌────────────────────┐
          │  Motor de Cálculo │   │  Cola de trabajos  │   │  Almacenamiento     │
          │  (dominio puro,   │   │  BullMQ + Redis    │   │  objetos (S3/MinIO) │
          │  sin I/O, testeable)│  │  OCR/parsing async │   │  documentos origen  │
          └──────────────────┘   └─────────┬──────────┘   └────────────────────┘
                                            ▼
                                  ┌───────────────────┐
                                  │  Worker OCR/Parser  │
                                  │  PDF/Excel → datos  │
                                  └───────────────────┘
                     ▼
          ┌──────────────────────────┐
          │   PostgreSQL (fuente de   │
          │   verdad, auditable)      │
          └──────────────────────────┘
```

## 2. Stack tecnológico propuesto

| Capa | Tecnología | Motivo |
|---|---|---|
| Frontend | **Next.js (React) + TypeScript + Tailwind + shadcn/ui** | Rapidez para tablas comparativas, formularios de carga y dashboards; SSR para informes compartibles. |
| Backend | **NestJS (Node/TypeScript)** | Estructura modular (Módulos = Clientes, Casos, Documentos, MotorCálculo, Auditorías), mismo lenguaje que el frontend, buen soporte de colas/validación/DI. |
| Base de datos | **PostgreSQL** | Relacional, transaccional, fuerte para auditabilidad (constraints, triggers, particionado por cliente si crece). `JSONB` para metadata flexible (ej. detalle de cálculo por rubro). |
| ORM | **Prisma** (o TypeORM) | Migraciones versionadas, tipado end-to-end. |
| Cola de trabajos | **BullMQ + Redis** | Procesamiento asíncrono de OCR/parsing (documentos pueden tardar; no bloquear el request). |
| OCR / extracción PDF | **AWS Textract o Azure Document Intelligence** (documentos escaneados/telegramas) + **pdf-parse / pdfplumber** (PDFs con texto nativo) + **SheetJS (xlsx)** para Excel | Combinación pragmática: Textract/Document Intelligence da mejor precisión en documentos escaneados y layouts variables (recibos de sueldo); parsers directos son más baratos y rápidos para PDF/Excel "de texto". |
| Motor de cálculo | Librería propia en **TypeScript puro** (`packages/motor-calculo`), sin dependencias de framework | Cada fórmula (antigüedad, SAC, vacaciones, preaviso, multas) es una función pura, versionada por fecha de vigencia normativa, con suite de tests unitarios por caso de jurisprudencia/ejemplo conocido. |
| Almacenamiento de archivos | **S3 / MinIO (self-hosted)** | Documentos originales (recibos, telegramas) separados de la DB, con URL firmada. |
| Generación de informes | **Puppeteer** (HTML→PDF) o **WeasyPrint** si se opta por worker Python | Informe de auditoría con cuadro comparativo y hallazgos, exportable a PDF. |
| Auth | **JWT + RBAC** (roles: admin, auditor, cliente-lectura) | Clientes externos podrían tener acceso de solo lectura a sus propios casos. |
| Infraestructura | Monorepo (**Turborepo/Nx**), Docker Compose para dev, despliegue en contenedores (ECS/Cloud Run/Render) | Escalado independiente de API vs. workers de OCR. |

**Alternativa viable**: si el equipo tiene más experiencia en Python, un backend **Django + DRF + Celery** es igualmente sólido y con mejor ecosistema nativo de OCR/ciencia de datos (pytesseract, pdfplumber, pandas para Excel). La decisión NestJS vs. Django es más de preferencia de equipo que de capacidad técnica — ambas cubren los requisitos.

## 3. Principios de diseño clave

- **El motor de cálculo es independiente y versionado por vigencia normativa.** Las fórmulas (tope indemnizatorio, art. 245 LCT, multas 25.323/25.345, etc.) cambian por ley/decreto/CCT aplicable. Cada fórmula se implementa como función pura `(variables, fechaVigencia) → resultado`, para poder auditar liquidaciones históricas con las reglas vigentes al momento del despido, no con las reglas actuales.
- **Todo dato base es trazable a su origen** (`manual`, `ocr`, `importado`) con nivel de confianza, para que un auditor pueda revisar rápido qué variables fueron extraídas automáticamente vs. cargadas a mano.
- **La comparación nunca sobrescribe lo declarado por la empresa.** `Liquidación` tiene siempre dos "orígenes" (`empresa` y `sistema`); los hallazgos se calculan como diferencia entre ambos, preservando el dato crudo para el informe final.
- **Diseño multi-cliente desde el modelo de datos**, no como tenant de infraestructura: todas las tablas de negocio cuelgan de `cliente_id`, permitiendo escalar a multi-tenant real (schema-per-tenant) más adelante sin rediseño si el volumen lo justifica.
