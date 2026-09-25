import { Body, Controller, Param, Post } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { AuditoriasService } from './auditorias.service';

class EjecutarAuditoriaDto {
  @IsOptional()
  @IsString()
  usuarioId?: string;
}

@Controller('casos/:casoId/auditorias')
export class AuditoriasController {
  constructor(private readonly auditoriasService: AuditoriasService) {}

  @Post()
  ejecutar(@Param('casoId') casoId: string, @Body() dto: EjecutarAuditoriaDto) {
    return this.auditoriasService.ejecutar(casoId, dto.usuarioId);
  }
}
