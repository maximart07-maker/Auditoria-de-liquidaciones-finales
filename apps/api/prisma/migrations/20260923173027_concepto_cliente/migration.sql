-- CreateEnum
CREATE TYPE "TipoConceptoNomina" AS ENUM ('remunerativo', 'no_remunerativo', 'descuento');

-- CreateTable
CREATE TABLE "concepto_cliente" (
    "id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "tipo" "TipoConceptoNomina" NOT NULL,
    "caracteristica" "TipoConcepto",
    "base_indemnizacion" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "concepto_cliente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "concepto_cliente_cliente_id_codigo_key" ON "concepto_cliente"("cliente_id", "codigo");

-- AddForeignKey
ALTER TABLE "concepto_cliente" ADD CONSTRAINT "concepto_cliente_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
