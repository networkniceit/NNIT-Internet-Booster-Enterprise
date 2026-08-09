export interface RelayClientSettings {
  relayUrl: string;
  clientName: string;
  sessionId: string;
  token: string;
  connected: boolean;
  lastHeartbeatAt: string | null;
}
