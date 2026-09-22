import { Module } from '@nestjs/common';
import { ConfiguracionesRubroController } from './configuraciones-rubro.controller';
import { ConfiguracionesRubroService } from './configuraciones-rubro.service';

@Module({
  controllers: [ConfiguracionesRubroController],
  providers: [ConfiguracionesRubroService],
  exports: [ConfiguracionesRubroService],
})
export class ConfiguracionesRubroModule {}
