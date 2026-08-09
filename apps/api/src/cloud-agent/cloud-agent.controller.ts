import {Body,Controller,Get,Post,Put} from '@nestjs/common';
import {CloudAgentService} from './cloud-agent.service';
@Controller('api/cloud-agent')
export class CloudAgentController{
 constructor(private readonly c:CloudAgentService){}
 @Get('status')status():unknown{return this.c.getStatus()}
 @Get('settings')settings():unknown{return this.c.getSettings()}
 @Put('settings')update(@Body()v:any):Promise<unknown>{return this.c.updateSettings(v)}
 @Post('register')register():Promise<unknown>{return this.c.register()}
 @Post('heartbeat')heartbeat():Promise<unknown>{return this.c.heartbeat()}
 @Post('telemetry')telemetry():Promise<unknown>{return this.c.telemetry()}
 @Post('commands/poll')poll():Promise<unknown>{return this.c.poll()}
 @Post('start')start():Promise<unknown>{return this.c.start()}
}
