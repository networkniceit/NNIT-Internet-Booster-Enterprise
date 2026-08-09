import { Module } from '@nestjs/common';
import { RelayClientController } from './relay-client.controller';
import { RelayClientService } from './relay-client.service';

@Module({
  controllers: [RelayClientController],
  providers: [RelayClientService],
  exports: [RelayClientService],
})
export class RelayClientModule {}
