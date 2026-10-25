-- CreateTable
CREATE TABLE "reporte_f931" (
    "id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "periodo" DATE NOT NULL,
    "nombre_archivo" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reporte_f931_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reporte_f931_empleado" (
    "id" TEXT NOT NULL,
    "reporte_id" TEXT NOT NULL,
    "legajo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "cuil" TEXT NOT NULL,
    "modalidad_contratacion" TEXT NOT NULL,
    "condicion" TEXT NOT NULL,
    "convenio" TEXT NOT NULL,
    "remuneracion_total" DECIMAL(16,2) NOT NULL,
    "remuneracion_1" DECIMAL(16,2) NOT NULL,
    "remuneracion_2" DECIMAL(16,2) NOT NULL,
    "remuneracion_3" DECIMAL(16,2) NOT NULL,
    "remuneracion_4" DECIMAL(16,2) NOT NULL,
    "remuneracion_5" DECIMAL(16,2) NOT NULL,
    "remuneracion_8" DECIMAL(16,2) NOT NULL,
    "remuneracion_9" DECIMAL(16,2) NOT NULL,
    "remuneracion_10" DECIMAL(16,2) NOT NULL,
    "monto_detraer" DECIMAL(16,2) NOT NULL,
    "monto_detraer_sac" DECIMAL(16,2) NOT NULL,
    "total_detraer" DECIMAL(16,2) NOT NULL,

    CONSTRAINT "reporte_f931_empleado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reporte_f931_cliente_id_periodo_key" ON "reporte_f931"("cliente_id", "periodo");

-- CreateIndex
CREATE UNIQUE INDEX "reporte_f931_empleado_reporte_id_cuil_key" ON "reporte_f931_empleado"("reporte_id", "cuil");

-- AddForeignKey
ALTER TABLE "reporte_f931" ADD CONSTRAINT "reporte_f931_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reporte_f931_empleado" ADD CONSTRAINT "reporte_f931_empleado_reporte_id_fkey" FOREIGN KEY ("reporte_id") REFERENCES "reporte_f931"("id") ON DELETE CASCADE ON UPDATE CASCADE;

