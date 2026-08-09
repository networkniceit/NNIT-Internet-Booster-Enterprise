import { Injectable } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

@Injectable()
export class FleetService {
  private readonly cloudSettingsFile =
    join(process.cwd(), 'data', 'cloud-agent.json');

  private getCloudSettings() {
    if (!existsSync(this.cloudSettingsFile)) {
      throw new Error('Cloud agent settings are not configured.');
    }

    const value = JSON.parse(
      readFileSync(this.cloudSettingsFile, 'utf8'),
    );

    const cloudUrl = String(
      value.cloudUrl ?? '',
    ).replace(/\/+$/, '');

    const apiKey = String(
      value.apiKey ?? '',
    );

    if (!cloudUrl || !apiKey) {
      throw new Error('Cloud URL or API key is missing.');
    }

    return {
      cloudUrl,
      apiKey,
    };
  }

  private async req(
    path: string,
    init: RequestInit = {},
  ) {
    const {
      cloudUrl,
      apiKey,
    } = this.getCloudSettings();

    const response = await fetch(
      cloudUrl + path,
      {
        ...init,
        headers: {
          'content-type':
            'application/json',
          'x-nnit-api-key':
            apiKey,
          ...(init.headers ?? {}),
        },
        signal:
          AbortSignal.timeout(
            20000,
          ),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Cloud ${response.status}: ${await response.text()}`,
      );
    }

    const text =
      await response.text();

    return text
      ? JSON.parse(text)
      : {};
  }

  summary() {
    return this.req(
      '/api/summary',
    );
  }

  devices() {
    return this.req(
      '/api/devices',
    );
  }

  analytics(
    limit = 500,
  ) {
    const safeLimit =
      Math.max(
        1,
        Math.min(
          2000,
          Number(limit || 500),
        ),
      );

    return this.req(
      `/api/analytics?limit=${safeLimit}`,
    );
  }

  alerts() {
    return this.req(
      '/api/alerts',
    );
  }

  acknowledgeAlert(
    id: string,
  ) {
    return this.req(
      `/api/alerts/${id}/acknowledge`,
      {
        method: 'POST',
      },
    );
  }

  resolveAlert(
    id: string,
  ) {
    return this.req(
      `/api/alerts/${id}/resolve`,
      {
        method: 'POST',
      },
    );
  }

  command(
    deviceId: string,
    type: string,
  ) {
    const allowed = [
      'ping-agent',
      'send-telemetry',
      'run-diagnostics',
      'flush-dns',
      'renew-ip',
    ];

    if (!allowed.includes(type)) {
      throw new Error(
        `Unsupported command: ${type}`,
      );
    }

    return this.req(
      '/api/commands',
      {
        method: 'POST',
        body:
          JSON.stringify({
            deviceId,
            type,
            payload: {},
          }),
      },
    );
  }
}
