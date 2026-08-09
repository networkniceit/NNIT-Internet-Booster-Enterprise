import {
  Body,
  Controller,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import { FleetService } from './fleet.service';

@Controller('api/fleet')
export class FleetController {
  constructor(
    private readonly f:
      FleetService,
  ) {}

  @Get('summary')
  summary(): Promise<unknown> {
    return this.f.summary();
  }

  @Get('devices')
  devices(): Promise<unknown> {
    return this.f.devices();
  }

  @Get('analytics')
  analytics(
    @Query('limit')
    limit?: string,
  ): Promise<unknown> {
    return this.f.analytics(
      Number(
        limit ?? 500,
      ),
    );
  }

  @Get('alerts')
  alerts(): Promise<unknown> {
    return this.f.alerts();
  }

  @Post('alerts/acknowledge')
  acknowledge(
    @Body()
    body: {
      id: string;
    },
  ): Promise<unknown> {
    return this.f.acknowledgeAlert(
      String(
        body.id ?? '',
      ),
    );
  }

  @Post('alerts/resolve')
  resolve(
    @Body()
    body: {
      id: string;
    },
  ): Promise<unknown> {
    return this.f.resolveAlert(
      String(
        body.id ?? '',
      ),
    );
  }

  @Post('commands')
  command(
    @Body()
    body: {
      deviceId: string;
      type: string;
    },
  ): Promise<unknown> {
    return this.f.command(
      String(
        body.deviceId ?? '',
      ),
      String(
        body.type ?? '',
      ),
    );
  }
}
