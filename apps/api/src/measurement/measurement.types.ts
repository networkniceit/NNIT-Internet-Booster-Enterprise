export interface UnifiedMeasurement {
  timestamp:string;
  online:boolean;
  gatewayLatencyMs:number|null;
  internetTcpLatencyMs:number|null;
  dnsLatencyMs:number|null;
  relayUdpLatencyMs:number|null;
  relayUdpJitterMs:number|null;
  relayUdpPacketLoss:number|null;
  jitterMs:number|null;
  packetLoss:number;
  score:number;
  activeAdapter:string|null;
  source:'relay-udp'|'multi-metric'|'fallback';
}
