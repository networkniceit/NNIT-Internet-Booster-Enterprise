import { Injectable } from '@nestjs/common';
import { hostname, networkInterfaces } from 'node:os';
import dgram from 'node:dgram';
import { RelayClientSettings } from './relay-client.types';

@Injectable()
export class RelayClientService {
  private latestPathTest: any = null;
  private settings: RelayClientSettings = {
    relayUrl: 'http://localhost:4500',
    clientName: hostname(),
    sessionId: '',
    token: '',
    connected: false,
    lastHeartbeatAt: null,
  };

  getStatus() {
    return {
      ...this.settings,
      token: this.settings.token ? 'configured' : '',
    };
  }

  async createSession(relayUrl?: string) {
    if (relayUrl) {
      this.settings.relayUrl = relayUrl.replace(/\/+$/, '');
    }

    const response = await fetch(`${this.settings.relayUrl}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientName: this.settings.clientName,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`Relay session failed: HTTP ${response.status}`);
    }

    const session = (await response.json()) as {
      sessionId: string;
      token: string;
      udpHost: string;
      udpPort: number;
      createdAt: string;
    };

    this.settings.sessionId = session.sessionId;
    this.settings.token = session.token;
    this.settings.connected = true;
    this.settings.lastHeartbeatAt = session.createdAt;

    return {
      ...this.settings,
      udpHost: session.udpHost,
      udpPort: session.udpPort,
      token: 'configured',
    };
  }

  async heartbeat() {
    if (!this.settings.token) {
      throw new Error('Create a relay session first.');
    }

    const links = Object.entries(networkInterfaces())
      .filter(([, values]) =>
        (values ?? []).some(
          (item) => item.family === 'IPv4' && !item.internal,
        ),
      )
      .map(([name]) => name);

    const response = await fetch(
      `${this.settings.relayUrl}/sessions/heartbeat`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.settings.token}`,
        },
        body: JSON.stringify({ links }),
        signal: AbortSignal.timeout(10000),
      },
    );

    if (!response.ok) {
      this.settings.connected = false;
      throw new Error(`Relay heartbeat failed: HTTP ${response.status}`);
    }

    const result = await response.json();
    this.settings.connected = true;
    this.settings.lastHeartbeatAt = new Date().toISOString();

    return result;
  }

  async testPath(linkName = 'Wi-Fi', count = 5) {
    if (!this.settings.token) {
      throw new Error('Create a relay session first.');
    }

    const url = new URL(this.settings.relayUrl);
    const host = url.hostname;
    const port = 4501;

    const results: Array<{
      sequence: number;
      success: boolean;
      roundTripMs: number | null;
      linkName: string;
    }> = [];

    const socket = dgram.createSocket('udp4');

    try {
      for (let sequence = 1; sequence <= count; sequence += 1) {
        const started = performance.now();

        const result = await new Promise<{
          success: boolean;
          roundTripMs: number | null;
        }>((resolve) => {
          const timeout = setTimeout(() => {
            resolve({ success: false, roundTripMs: null });
          }, 3000);

          socket.once('message', (message) => {
            clearTimeout(timeout);

            try {
              const payload = JSON.parse(message.toString('utf8')) as {
                ok?: boolean;
              };

              resolve({
                success: Boolean(payload.ok),
                roundTripMs: Math.max(
                  1,
                  Math.round(performance.now() - started),
                ),
              });
            } catch {
              resolve({ success: false, roundTripMs: null });
            }
          });

          const payload = Buffer.from(
            JSON.stringify({
              token: this.settings.token,
              sequence,
              sentAt: Date.now(),
              linkName,
            }),
          );

          socket.send(payload, port, host);
        });

        results.push({
          sequence,
          success: result.success,
          roundTripMs: result.roundTripMs,
          linkName,
        });
      }
    } finally {
      socket.close();
    }

    const successful = results.map((item) => item.roundTripMs).filter((value): value is number => value !== null);
    const differences = successful.slice(1).map((value, index) => Math.abs(value - successful[index])).sort((a, b) => a - b);
    const middle = Math.floor(differences.length / 2);
    const jitterMs = differences.length === 0 ? null : differences.length % 2 === 0 ? Math.round((differences[middle - 1] + differences[middle]) / 2) : differences[middle];
    const result = {
      linkName,
      successCount: successful.length,
      count,
      averageRoundTripMs: this.average(successful),
      jitterMs,
      packetLoss: Math.round((1 - successful.length / count) * 100),
      results,
    };
    this.latestPathTest = result;
    return result;
  }

  async quickQualityProbe(linkName = 'Wi-Fi') {
    if (!this.settings.connected || !this.settings.token) return null;
    try { return await this.testPath(linkName, 5); } catch { return null; }
  }

  private average(values: number[]) {
    if (!values.length) return null;

    return Math.round(
      values.reduce((total, value) => total + value, 0) / values.length,
    );
  }
}


