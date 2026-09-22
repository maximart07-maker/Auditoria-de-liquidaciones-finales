import { Module } from '@nestjs/common';
import { RemuneracionesMensualesController } from './remuneraciones-mensuales.controller';
import { RemuneracionesMensualesService } from './remuneraciones-mensuales.service';

@Module({
  controllers: [RemuneracionesMensualesController],
  providers: [RemuneracionesMensualesService],
  exports: [RemuneracionesMensualesService],
})
export class RemuneracionesMensualesModule {}
