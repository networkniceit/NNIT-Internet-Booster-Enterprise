import {
  Body,
  Controller,
  Get,
  Post,
  Put,
} from '@nestjs/common';
import { SteeringService } from './steering.service';

@Controller('api/steering')
export class SteeringController {
  constructor(
    private readonly steering:
      SteeringService,
  ) {}

  @Get('status')
  getStatus(): Promise<unknown> {
    return this.steering.getStatus();
  }

  @Get('settings')
  getSettings() {
    return this.steering.getSettings();
  }

  @Put('settings')
  updateSettings(
    @Body()
    input: {
      automatic?: boolean;
      minimumImprovement?: number;
    },
  ) {
    return this.steering.updateSettings(
      input,
    );
  }

  @Post('apply')
  applyPreferredAdapter(
    @Body()
    input: {
      adapterName: string;
    },
  ) {
    return this.steering.applyPreferredAdapter(
      input.adapterName,
    );
  }

  @Post('restore')
  restoreAutomaticMetrics() {
    return this.steering.restoreAutomaticMetrics();
  }
}

