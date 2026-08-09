import { Body,Controller,Delete,Get,Param,Post } from '@nestjs/common';
import { QosService } from './qos.service';
@Controller('api/qos')
export class QosController{
 constructor(private readonly qos:QosService){}
 @Get('status')status():unknown{return this.qos.getStatus()}
 @Post('rules')create(@Body()input:any):unknown{return this.qos.create(input)}
 @Post('rules/:id/apply')apply(@Param('id')id:string):Promise<unknown>{return this.qos.apply(id)}
 @Post('rules/:id/remove')remove(@Param('id')id:string):Promise<unknown>{return this.qos.remove(id)}
 @Delete('rules/:id')delete(@Param('id')id:string):Promise<unknown>{return this.qos.delete(id)}
}
