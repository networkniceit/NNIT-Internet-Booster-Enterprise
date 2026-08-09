import {Body,Controller,Delete,Get,Post,Put} from '@nestjs/common';
import {FailoverService} from './failover.service';
import {FailoverSettings} from './failover.types';
@Controller('api/failover')
export class FailoverController{
 constructor(private readonly f:FailoverService){}
 @Get('status')status(){return this.f.getStatus()}
 @Put('settings')settings(@Body()v:Partial<FailoverSettings>){return this.f.updateSettings(v)}
 @Post('evaluate')evaluate(){return this.f.evaluate()}
 @Delete('history')clear(){return this.f.clearHistory()}
}
