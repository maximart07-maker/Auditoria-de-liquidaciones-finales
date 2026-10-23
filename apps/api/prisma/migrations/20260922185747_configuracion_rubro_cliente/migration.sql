-- CreateEnum
CREATE TYPE "TipoConcepto" AS ENUM ('fijo', 'variable');

-- AlterTable
ALTER TABLE "rubro" ADD COLUMN     "es_legal" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "tipo_default" "TipoConcepto" NOT NULL DEFAULT 'fijo';

-- CreateTable
CREATE TABLE "configuracion_rubro_cliente" (
    "id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "rubro_id" TEXT NOT NULL,
    "tipo" "TipoConcepto" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "valor_fijo" DECIMAL(14,2),
    "parametros" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracion_rubro_cliente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "configuracion_rubro_cliente_cliente_id_rubro_id_key" ON "configuracion_rubro_cliente"("cliente_id", "rubro_id");

-- AddForeignKey
ALTER TABLE "configuracion_rubro_cliente" ADD CONSTRAINT "configuracion_rubro_cliente_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuracion_rubro_cliente" ADD CONSTRAINT "configuracion_rubro_cliente_rubro_id_fkey" FOREIGN KEY ("rubro_id") REFERENCES "rubro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
