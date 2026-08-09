export interface SystemTelemetry {
  hostname: string;
  platform: string;
  release: string;
  arch: string;
  uptimeSeconds: number;
  cpuPercent: number | null;
  memoryUsedPercent: number | null;
  totalMemoryBytes: number;
  freeMemoryBytes: number;
  systemDriveFreeBytes: number | null;
  systemDriveTotalBytes: number | null;
  timestamp: string;
}

export interface DiagnosticResult {
  healthy: boolean;
  dnsResolved: boolean;
  internetReachable: boolean;
  defaultGateway: string | null;
  activeAdapter: string | null;
  cloudReachable: boolean | null;
  notes: string[];
  timestamp: string;
}
