export interface OptimizerSample {
  timestamp: string;
  online: boolean;
  latencyMs: number | null;
  packetLoss: number;
  score: number;
  activeAdapter: string | null;
}

export interface OptimizerSettings {
  enabled: boolean;
  automaticFailover: boolean;
  minimumScore: number;
  preferredAdapter: string;
  probeIntervalMs: number;
}
