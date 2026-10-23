import { Module } from '@nestjs/common';
import { LiquidacionesController } from './liquidaciones.controller';
import { LiquidacionesService } from './liquidaciones.service';

@Module({
  controllers: [LiquidacionesController],
  providers: [LiquidacionesService],
  exports: [LiquidacionesService],
})
export class LiquidacionesModule {}
