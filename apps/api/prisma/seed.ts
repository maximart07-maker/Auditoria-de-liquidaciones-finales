import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Catálogo mínimo viable de rubros — códigos alineados con `CodigoRubro` en
 * @audit/motor-calculo (packages/motor-calculo/src/tipos.ts). */
const RUBROS = [
  { codigo: 'IND_ANTIGUEDAD', nombre: 'Indemnización por antigüedad', baseLegal: 'Art. 245 LCT' },
  { codigo: 'PREAVISO', nombre: 'Preaviso / indemnización sustitutiva', baseLegal: 'Arts. 231/232 LCT' },
  { codigo: 'INTEGRACION_MES', nombre: 'Integración del mes de despido', baseLegal: 'Art. 233 LCT' },
  { codigo: 'SAC_PROP', nombre: 'SAC proporcional', baseLegal: 'Ley 23.041' },
  { codigo: 'VAC_NO_GOZADAS', nombre: 'Vacaciones no gozadas', baseLegal: 'Arts. 150 y 156 LCT' },
  { codigo: 'SAC_S_VAC', nombre: 'SAC sobre vacaciones no gozadas', baseLegal: 'Arts. 150 y 156 LCT' },
  { codigo: 'MULTA_ART2_25323', nombre: 'Multa por falta de pago en término', baseLegal: 'Art. 2 Ley 25.323' },
  { codigo: 'MULTA_ART1_25323', nombre: 'Multa por registración deficiente', baseLegal: 'Art. 1 Ley 25.323' },
  { codigo: 'MULTA_ART80', nombre: 'Multa por falta de entrega de certificados', baseLegal: 'Art. 80 LCT' },
];

async function main() {
  for (const rubro of RUBROS) {
    // Todos los rubros del catálogo base provienen de la LCT/leyes complementarias:
    // esLegal=true bloquea que un cliente los desactive, les fije un monto manual
    // o los pase a "variable" (ver ConfiguracionRubroClienteService).
    await prisma.rubro.upsert({
      where: { codigo: rubro.codigo },
      update: { nombre: rubro.nombre, baseLegal: rubro.baseLegal, esLegal: true, tipoDefault: 'fijo' },
      create: { ...rubro, esLegal: true, tipoDefault: 'fijo' },
    });
  }
  console.log(`Seed completado: ${RUBROS.length} rubros.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
