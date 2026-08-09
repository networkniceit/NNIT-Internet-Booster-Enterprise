import {Body,Controller,Get,Post} from '@nestjs/common';
import {RemoteActionsService} from './remote-actions.service';
@Controller('api/remote-actions')
export class RemoteActionsController{
 constructor(private readonly a:RemoteActionsService){}
 @Get('allowed')allowed(){return{actions:this.a.getAllowed()}}
 @Post('execute')execute(@Body()b:any){return this.a.execute(String(b.type??''))}
}
