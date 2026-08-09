import {
  OnGatewayConnection,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { OptimizerService } from './optimizer.service';

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
  },
})
export class OptimizerGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly optimizer: OptimizerService) {}

  afterInit() {
    const timer = setInterval(() => {
      this.server.emit('optimizer:telemetry', this.optimizer.getLatest());
    }, 5000);
    timer.unref();
  }

  handleConnection(client: Socket) {
    client.emit('optimizer:telemetry', this.optimizer.getLatest());
  }
}
