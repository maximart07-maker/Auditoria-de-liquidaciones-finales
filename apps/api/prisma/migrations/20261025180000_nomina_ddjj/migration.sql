-- CreateTable
CREATE TABLE "nomina_ddjj" (
    "id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "periodo" DATE NOT NULL,
    "cuit" TEXT,
    "secuencia" TEXT,
    "nombre_archivo" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nomina_ddjj_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nomina_ddjj_empleado" (
    "id" TEXT NOT NULL,
    "nomina_id" TEXT NOT NULL,
    "cuil" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "datos" JSONB NOT NULL,

    CONSTRAINT "nomina_ddjj_empleado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "nomina_ddjj_cliente_id_periodo_key" ON "nomina_ddjj"("cliente_id", "periodo");

-- CreateIndex
CREATE UNIQUE INDEX "nomina_ddjj_empleado_nomina_id_cuil_key" ON "nomina_ddjj_empleado"("nomina_id", "cuil");

-- AddForeignKey
ALTER TABLE "nomina_ddjj" ADD CONSTRAINT "nomina_ddjj_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nomina_ddjj_empleado" ADD CONSTRAINT "nomina_ddjj_empleado_nomina_id_fkey" FOREIGN KEY ("nomina_id") REFERENCES "nomina_ddjj"("id") ON DELETE CASCADE ON UPDATE CASCADE;

