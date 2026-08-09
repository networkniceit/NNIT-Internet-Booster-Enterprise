export interface Adapter {
  name: string;
  ipv4: string;
  netmask: string;
  mac: string;
}

export interface NetworkStatus {
  online: boolean;
  score: number;
  latencyMs: number | null;
  packetLoss: number | null;
  downloadMbps: number | null;
  uploadMbps: number | null;
  activeAdapter: Adapter | null;
  adapters: Adapter[];
  computer: {
    hostname: string;
    platform: string;
    uptimeSeconds: number;
  };
  booster: {
    mode: string;
    dnsProfile: string;
    failoverEnabled: boolean;
    bondingEnabled: boolean;
  };
  timestamp: string;
}

const API_URL =
  import.meta.env.VITE_API_URL ??
  'http://localhost:4000';

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(
    `${API_URL}${path}`,
    {
      ...options,
      headers: {
        'Content-Type':
          'application/json',
        ...(options.headers ?? {}),
      },
    },
  );

  if (!response.ok) {
    const message =
      await response.text();

    throw new Error(
      message ||
        `API request failed: ${response.status}`,
    );
  }

  return response.json();
}

export function getNetworkStatus() {
  return request<NetworkStatus>(
    '/api/status',
  );
}

export function runSpeedTest() {
  return request<{
    downloadMbps: number;
  }>('/api/speed-test', {
    method: 'POST',
  });
}

export function applyOptimization(
  mode: string,
  dnsProfile: string,
) {
  return request<{
    success: boolean;
    message: string;
  }>('/api/optimization', {
    method: 'POST',
    body: JSON.stringify({
      mode,
      dnsProfile,
    }),
  });
}



