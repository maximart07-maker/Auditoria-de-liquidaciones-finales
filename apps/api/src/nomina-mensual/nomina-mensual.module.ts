import { Module } from '@nestjs/common';
import { NominaMensualController } from './nomina-mensual.controller';
import { NominaMensualService } from './nomina-mensual.service';
import { CargasSocialesModule } from '../cargas-sociales/cargas-sociales.module';

@Module({
  imports: [CargasSocialesModule],
  controllers: [NominaMensualController],
  providers: [NominaMensualService],
})
export class NominaMensualModule {}
