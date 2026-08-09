import { Body, Controller, Get, Put } from '@nestjs/common';
import { BondingService } from './bonding.service';
import { BondingSettings } from './bonding.types';
@Controller('api/bonding')
export class BondingController {
  constructor(private readonly bonding: BondingService) {}
  @Get('status') getStatus() { return this.bonding.getStatus(); }
  @Get('settings') getSettings() { return this.bonding.getSettings(); }
  @Put('settings') updateSettings(@Body() input: Partial<BondingSettings>) { return this.bonding.updateSettings(input); }
}
