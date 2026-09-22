import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { ClientesModule } from './clientes/clientes.module';
import { EmpleadosModule } from './empleados/empleados.module';
import { LotesModule } from './lotes/lotes.module';
import { CasosModule } from './casos/casos.module';
import { DocumentosModule } from './documentos/documentos.module';
import { RubrosModule } from './rubros/rubros.module';
import { LiquidacionesModule } from './liquidaciones/liquidaciones.module';
import { AuditoriasModule } from './auditorias/auditorias.module';
import { ConfiguracionesRubroModule } from './configuraciones-rubro/configuraciones-rubro.module';
import { RemuneracionesMensualesModule } from './remuneraciones-mensuales/remuneraciones-mensuales.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    ClientesModule,
    EmpleadosModule,
    LotesModule,
    CasosModule,
    DocumentosModule,
    RubrosModule,
    LiquidacionesModule,
    AuditoriasModule,
    ConfiguracionesRubroModule,
    RemuneracionesMensualesModule,
  ],
})
export class AppModule {}
