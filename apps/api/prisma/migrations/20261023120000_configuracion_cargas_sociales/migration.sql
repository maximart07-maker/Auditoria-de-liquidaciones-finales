-- CreateEnum
CREATE TYPE "TipoEmpleadorSUSS" AS ENUM ('pyme', 'gran_empresa');

-- CreateEnum
CREATE TYPE "RegimenDiferencialSUSS" AS ENUM ('comun', 'choferes', 'construccion', 'docentes', 'insalubres', 'manual');

-- CreateEnum
CREATE TYPE "RegimenDetraccion" AS ENUM ('general', 'incrementado', 'sin_detraccion');

-- CreateTable
CREATE TABLE "configuracion_cargas_sociales_cliente" (
    "id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "tipo_empleador" "TipoEmpleadorSUSS" NOT NULL,
    "regimen_diferencial" "RegimenDiferencialSUSS" NOT NULL DEFAULT 'comun',
    "adicional_diferencial_porcentaje" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "aplica_fal" BOOLEAN NOT NULL DEFAULT false,
    "art_porcentaje" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "art_cuota_fija" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "scvo_por_empleado" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "regimen_detraccion" "RegimenDetraccion" NOT NULL DEFAULT 'general',
    "monto_detraccion_personalizado" DECIMAL(14,2),
    "horas_semanales_jornada_parcial" DECIMAL(5,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracion_cargas_sociales_cliente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "configuracion_cargas_sociales_cliente_cliente_id_key" ON "configuracion_cargas_sociales_cliente"("cliente_id");

-- AddForeignKey
ALTER TABLE "configuracion_cargas_sociales_cliente" ADD CONSTRAINT "configuracion_cargas_sociales_cliente_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
