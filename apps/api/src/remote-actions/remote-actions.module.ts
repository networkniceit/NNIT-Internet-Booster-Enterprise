import {Module} from '@nestjs/common';
import {RemoteActionsController} from './remote-actions.controller';
import {RemoteActionsService} from './remote-actions.service';
@Module({controllers:[RemoteActionsController],providers:[RemoteActionsService],exports:[RemoteActionsService]})
export class RemoteActionsModule{}
