import { Body,Controller,Delete,Get,Post,Put } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { AlertSettings } from './alerts.types';

@Controller('api/alerts')
export class AlertsController{
 constructor(private readonly alerts:AlertsService){}

 @Get('status')
 getStatus(){return this.alerts.getStatus();}

 @Put('settings')
 updateSettings(@Body()input:Partial<AlertSettings>){
  return this.alerts.updateSettings(input);
 }

 @Post('evaluate')
 evaluate(){return this.alerts.evaluate();}

 @Post('acknowledge')
 acknowledge(@Body()input:{id:string}){
  return this.alerts.acknowledge(input.id);
 }

 @Delete()
 clear(){return this.alerts.clear();}
}
