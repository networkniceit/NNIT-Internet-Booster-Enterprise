export interface AlertSettings {
  enabled:boolean;
  latencyThresholdMs:number;
  dnsThresholdMs:number;
  jitterThresholdMs:number;
  packetLossThreshold:number;
  scoreThreshold:number;
  relayRequired:boolean;
  cooldownSeconds:number;
}

export interface AlertItem {
  id:string;
  timestamp:string;
  severity:'info'|'warning'|'critical';
  category:string;
  title:string;
  message:string;
  acknowledged:boolean;
}
