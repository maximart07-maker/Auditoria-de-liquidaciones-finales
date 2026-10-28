import { Module } from '@nestjs/common';
import { CargasSocialesController } from './cargas-sociales.controller';
import { CargasSocialesService } from './cargas-sociales.service';

@Module({
  controllers: [CargasSocialesController],
  providers: [CargasSocialesService],
  exports: [CargasSocialesService],
})
export class CargasSocialesModule {}
