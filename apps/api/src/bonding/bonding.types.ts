export interface BondingLink {
  name: string;
  ipv4: string | null;
  mac: string | null;
  virtual: boolean;
  connected: boolean;
  latencyMs: number | null;
  packetLoss: number;
  score: number;
  eligible: boolean;
}
export interface BondingSettings {
  enabled: boolean;
  strategy: 'failover' | 'balanced' | 'latency';
  relayHost: string;
  relayPort: number;
  encryption: boolean;
}
