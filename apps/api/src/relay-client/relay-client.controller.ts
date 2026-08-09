import { Body, Controller, Get, Post } from '@nestjs/common';
import { RelayClientService } from './relay-client.service';

@Controller('api/relay')
export class RelayClientController {
  constructor(private readonly relay: RelayClientService) {}

  @Get('status')
  getStatus() {
    return this.relay.getStatus();
  }

  @Post('session')
  createSession(@Body() input: { relayUrl?: string }) {
    return this.relay.createSession(input.relayUrl);
  }

  @Post('heartbeat')
  heartbeat() {
    return this.relay.heartbeat();
  }

  @Post('test')
  testPath(
    @Body()
    input: {
      linkName?: string;
      count?: number;
    },
  ) {
    return this.relay.testPath(
      input.linkName ?? 'Wi-Fi',
      Math.max(1, Math.min(20, Number(input.count ?? 5))),
    );
  }
}
