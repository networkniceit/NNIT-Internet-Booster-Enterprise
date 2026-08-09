import { Module } from '@nestjs/common';
import { BondingController } from './bonding.controller';
import { BondingService } from './bonding.service';
@Module({ controllers: [BondingController], providers: [BondingService], exports: [BondingService] })
export class BondingModule {}
