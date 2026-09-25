-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('admin', 'auditor', 'cliente_lectura');

-- CreateEnum
CREATE TYPE "MotivoLote" AS ENUM ('reestructuracion', 'despido_masivo', 'auditoria_periodica');

-- CreateEnum
CREATE TYPE "TipoExtincion" AS ENUM ('despido_sin_causa', 'despido_con_causa', 'renuncia', 'mutuo_acuerdo', 'vencimiento_contrato', 'fallecimiento');

-- CreateEnum
CREATE TYPE "EstadoCaso" AS ENUM ('borrador', 'en_revision', 'auditado', 'cerrado');

-- CreateEnum
CREATE TYPE "TipoDocumento" AS ENUM ('recibo_sueldo', 'telegrama', 'liquidacion_final', 'cct', 'otro');

-- CreateEnum
CREATE TYPE "EstadoProcesamiento" AS ENUM ('pendiente', 'procesando', 'procesado', 'error');

-- CreateEnum
CREATE TYPE "FuenteVariable" AS ENUM ('manual', 'ocr', 'importado');

-- CreateEnum
CREATE TYPE "OrigenLiquidacion" AS ENUM ('empresa', 'sistema');

-- CreateEnum
CREATE TYPE "EstadoLiquidacion" AS ENUM ('vigente', 'reemplazada');

-- CreateEnum
CREATE TYPE "EstadoAuditoria" AS ENUM ('ok', 'con_diferencias', 'requiere_revision');

-- CreateEnum
CREATE TYPE "SeveridadHallazgo" AS ENUM ('alta', 'media', 'baja');

-- CreateEnum
CREATE TYPE "EstadoHallazgo" AS ENUM ('pendiente', 'validado', 'descartado');

-- CreateTable
CREATE TABLE "cliente" (
    "id" TEXT NOT NULL,
    "razon_social" TEXT NOT NULL,
    "cuit" TEXT NOT NULL,
    "industria" TEXT,
    "contacto_email" TEXT,
    "fecha_alta" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id" TEXT NOT NULL,
    "cliente_id" TEXT,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "rol" "RolUsuario" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "empleado" (
    "id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "cuil" TEXT NOT NULL,
    "fecha_ingreso" DATE NOT NULL,
    "categoria" TEXT,
    "convenio_colectivo" TEXT,
    "provincia" TEXT,
    "remuneracion_base" DECIMAL(14,2),

    CONSTRAINT "empleado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lote" (
    "id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "motivo" "MotivoLote" NOT NULL,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "caso" (
    "id" TEXT NOT NULL,
    "empleado_id" TEXT NOT NULL,
    "lote_id" TEXT,
    "tipo_extincion" "TipoExtincion" NOT NULL,
    "fecha_extincion" DATE NOT NULL,
    "estado" "EstadoCaso" NOT NULL DEFAULT 'borrador',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "caso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documento" (
    "id" TEXT NOT NULL,
    "caso_id" TEXT NOT NULL,
    "tipo" "TipoDocumento" NOT NULL,
    "archivo_url" TEXT NOT NULL,
    "estado_procesamiento" "EstadoProcesamiento" NOT NULL DEFAULT 'pendiente',
    "texto_extraido" TEXT,
    "metadata" JSONB,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variable_caso" (
    "id" TEXT NOT NULL,
    "caso_id" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "fuente" "FuenteVariable" NOT NULL,
    "confianza" DECIMAL(3,2),
    "documento_origen_id" TEXT,

    CONSTRAINT "variable_caso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rubro" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "base_legal" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "rubro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "liquidacion" (
    "id" TEXT NOT NULL,
    "caso_id" TEXT NOT NULL,
    "origen" "OrigenLiquidacion" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "fecha_liquidacion" DATE,
    "estado" "EstadoLiquidacion" NOT NULL DEFAULT 'vigente',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "liquidacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "liquidacion_rubro" (
    "id" TEXT NOT NULL,
    "liquidacion_id" TEXT NOT NULL,
    "rubro_id" TEXT NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "detalle_calculo" JSONB,

    CONSTRAINT "liquidacion_rubro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditoria" (
    "id" TEXT NOT NULL,
    "caso_id" TEXT NOT NULL,
    "usuario_id" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" "EstadoAuditoria" NOT NULL,
    "resumen" TEXT,

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hallazgo" (
    "id" TEXT NOT NULL,
    "auditoria_id" TEXT NOT NULL,
    "rubro_id" TEXT NOT NULL,
    "monto_declarado" DECIMAL(14,2) NOT NULL,
    "monto_calculado" DECIMAL(14,2) NOT NULL,
    "porcentaje_diferencia" DECIMAL(6,2),
    "severidad" "SeveridadHallazgo",
    "estado" "EstadoHallazgo" NOT NULL DEFAULT 'pendiente',
    "comentario" TEXT,

    CONSTRAINT "hallazgo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "informe" (
    "id" TEXT NOT NULL,
    "caso_id" TEXT,
    "lote_id" TEXT,
    "formato" TEXT NOT NULL DEFAULT 'pdf',
    "archivo_url" TEXT NOT NULL,
    "fecha_generacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "informe_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cliente_cuit_key" ON "cliente"("cuit");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "empleado_cliente_id_cuil_key" ON "empleado"("cliente_id", "cuil");

-- CreateIndex
CREATE UNIQUE INDEX "variable_caso_caso_id_clave_key" ON "variable_caso"("caso_id", "clave");

-- CreateIndex
CREATE UNIQUE INDEX "rubro_codigo_key" ON "rubro"("codigo");

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empleado" ADD CONSTRAINT "empleado_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lote" ADD CONSTRAINT "lote_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caso" ADD CONSTRAINT "caso_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caso" ADD CONSTRAINT "caso_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "lote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento" ADD CONSTRAINT "documento_caso_id_fkey" FOREIGN KEY ("caso_id") REFERENCES "caso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variable_caso" ADD CONSTRAINT "variable_caso_caso_id_fkey" FOREIGN KEY ("caso_id") REFERENCES "caso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variable_caso" ADD CONSTRAINT "variable_caso_documento_origen_id_fkey" FOREIGN KEY ("documento_origen_id") REFERENCES "documento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidacion" ADD CONSTRAINT "liquidacion_caso_id_fkey" FOREIGN KEY ("caso_id") REFERENCES "caso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidacion_rubro" ADD CONSTRAINT "liquidacion_rubro_liquidacion_id_fkey" FOREIGN KEY ("liquidacion_id") REFERENCES "liquidacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidacion_rubro" ADD CONSTRAINT "liquidacion_rubro_rubro_id_fkey" FOREIGN KEY ("rubro_id") REFERENCES "rubro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_caso_id_fkey" FOREIGN KEY ("caso_id") REFERENCES "caso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hallazgo" ADD CONSTRAINT "hallazgo_auditoria_id_fkey" FOREIGN KEY ("auditoria_id") REFERENCES "auditoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hallazgo" ADD CONSTRAINT "hallazgo_rubro_id_fkey" FOREIGN KEY ("rubro_id") REFERENCES "rubro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "informe" ADD CONSTRAINT "informe_caso_id_fkey" FOREIGN KEY ("caso_id") REFERENCES "caso"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "informe" ADD CONSTRAINT "informe_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "lote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
