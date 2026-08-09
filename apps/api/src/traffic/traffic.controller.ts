import {
  Controller,
  Get,
} from '@nestjs/common';
import { TrafficService } from './traffic.service';

@Controller('api/traffic')
export class TrafficController {
  constructor(
    private readonly traffic:
      TrafficService,
  ) {}

  @Get('live')
  getLive(): unknown {
    return this.traffic.getLatest();
  }

  @Get('refresh')
  refresh(): Promise<unknown> {
    return this.traffic.refresh();
  }
}
