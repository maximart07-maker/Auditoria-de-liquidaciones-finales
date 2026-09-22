-- DropForeignKey
ALTER TABLE "remuneracion_mensual" DROP CONSTRAINT "remuneracion_mensual_caso_id_fkey";

-- DropIndex
DROP INDEX "remuneracion_mensual_caso_id_periodo_key";

-- AlterTable
ALTER TABLE "remuneracion_mensual" DROP COLUMN "caso_id",
ADD COLUMN     "empleado_id" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "remuneracion_mensual_empleado_id_periodo_key" ON "remuneracion_mensual"("empleado_id", "periodo");

-- AddForeignKey
ALTER TABLE "remuneracion_mensual" ADD CONSTRAINT "remuneracion_mensual_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
