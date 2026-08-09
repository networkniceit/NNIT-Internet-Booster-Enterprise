import { Body, Controller, Get, Put } from '@nestjs/common';
import { OptimizerService } from './optimizer.service';
import { OptimizerSettings } from './optimizer.types';

@Controller('api/optimizer')
export class OptimizerController {
  constructor(private readonly optimizer: OptimizerService) {}

  @Get('status')
  getStatus() {
    return this.optimizer.getLatest();
  }

  @Get('history')
  getHistory() {
    return this.optimizer.getHistory();
  }

  @Get('settings')
  getSettings() {
    return this.optimizer.getSettings();
  }

  @Put('settings')
  updateSettings(@Body() input: Partial<OptimizerSettings>) {
    return this.optimizer.updateSettings(input);
  }
}
