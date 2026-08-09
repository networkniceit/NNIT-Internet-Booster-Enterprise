export interface FailoverSettings {
  enabled:boolean;
  minimumImprovement:number;
  holdCycles:number;
  cooldownSeconds:number;
  emergencyPacketLoss:number;
}
export interface FailoverEvent {
  timestamp:string;
  previousAdapter:string|null;
  newAdapter:string;
  reason:string;
  previousScore:number|null;
  newScore:number;
}
