-- CreateTable
CREATE TABLE "remuneracion_mensual" (
    "id" TEXT NOT NULL,
    "caso_id" TEXT NOT NULL,
    "periodo" DATE NOT NULL,
    "conceptos_remunerativos" DECIMAL(14,2) NOT NULL,
    "es_normal_y_habitual" BOOLEAN NOT NULL DEFAULT true,
    "detalle" JSONB,
    "fuente" "FuenteVariable" NOT NULL DEFAULT 'manual',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "remuneracion_mensual_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "remuneracion_mensual_caso_id_periodo_key" ON "remuneracion_mensual"("caso_id", "periodo");

-- AddForeignKey
ALTER TABLE "remuneracion_mensual" ADD CONSTRAINT "remuneracion_mensual_caso_id_fkey" FOREIGN KEY ("caso_id") REFERENCES "caso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
