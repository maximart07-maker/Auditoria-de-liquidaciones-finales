import { Controller, Get } from '@nestjs/common';
import { RubrosService } from './rubros.service';

@Controller('rubros')
export class RubrosController {
  constructor(private readonly rubrosService: RubrosService) {}

  @Get()
  findAll() {
    return this.rubrosService.findAll();
  }
}
