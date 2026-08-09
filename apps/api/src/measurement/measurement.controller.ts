import {
  Controller,
  Get,
  Query,
} from '@nestjs/common';
import { MeasurementService } from './measurement.service';

@Controller('api/measurement')
export class MeasurementController {
  constructor(
    private readonly measurement:
      MeasurementService,
  ) {}

  @Get('latest')
  getLatest() {
    return this.measurement.getLatest();
  }

  @Get('history')
  getHistory(
    @Query('limit') limit?: string,
  ) {
    return this.measurement.getHistory(
      Number(limit ?? 180),
    );
  }

  @Get('refresh')
  refresh() {
    return this.measurement.refresh();
  }
}
