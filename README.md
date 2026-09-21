# Auditoría de Liquidaciones Finales

Sistema para el control, comparación y auditoría de liquidaciones finales de sueldos (despidos, renuncias, mutuos acuerdos, etc.) para múltiples clientes, bajo legislación laboral argentina.

Permite gestionar uno o varios clientes en simultáneo, desde una liquidación puntual hasta lotes masivos (despidos masivos, reestructuraciones, auditorías periódicas), comparando **lo liquidado por la empresa** contra **lo calculado por el motor de auditoría** y generando informes de hallazgos.

## Documentación

- [`docs/arquitectura.md`](docs/arquitectura.md) — Propuesta de arquitectura general y stack tecnológico.
- [`docs/modelo-datos.md`](docs/modelo-datos.md) — Modelo de datos (entidades, relaciones, DDL).
- [`docs/flujo-ux.md`](docs/flujo-ux.md) — Flujo de usuario (UX/UI), de la carga de documentos al informe de auditoría.
- [`docs/motor-calculo.md`](docs/motor-calculo.md) — Lógica de negocio y pseudocódigo de las fórmulas de auditoría.

> Este repositorio está en etapa de diseño. La documentación se irá completando a medida que se valide el código base.

## Estado

- [x] Propuesta de arquitectura general
- [x] Modelo de datos inicial
- [x] Flujo de usuario (UX/UI)
- [x] Motor de cálculo (lógica de negocio y pseudocódigo de fórmulas)
- [ ] Scaffolding de backend/frontend
