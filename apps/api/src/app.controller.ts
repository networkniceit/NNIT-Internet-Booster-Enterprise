import {
  Body,
  Controller,
  Get,
  Post,
} from '@nestjs/common';
import {
  hostname,
  networkInterfaces,
  platform,
  uptime,
} from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { MeasurementService } from './measurement/measurement.service';

const execFileAsync =
  promisify(execFile);

interface OptimizationRequest {
  mode?: string;
  dnsProfile?: string;
}

@Controller()
export class AppController {
  private settings = {
    mode: 'balanced',
    dnsProfile: 'automatic',
    failoverEnabled: false,
    bondingEnabled: false,
  };

  private lastDownloadMbps:
    | number
    | null = null;

  constructor(
    private readonly measurement:
      MeasurementService,
  ) {}

  @Get()
  getRoot() {
    return {
      name:
        'NNIT Internet Booster Enterprise API',
      status: 'online',
      version: '2.3.0',
    };
  }

  @Get('api/health')
  getHealth() {
    return {
      healthy: true,
      timestamp:
        new Date().toISOString(),
    };
  }

  @Get('api/status')
  getStatus() {
    const adapters =
      this.getAdapters();

    const activeAdapter =
      this.selectActiveAdapter(
        adapters,
      );

    const measurement =
      this.measurement.getLatest();

    return {
      online:
        measurement.online,
      score:
        measurement.score,
      latencyMs:
        measurement.internetTcpLatencyMs,
      gatewayLatencyMs:
        measurement.gatewayLatencyMs,
      internetTcpLatencyMs:
        measurement.internetTcpLatencyMs,
      dnsLatencyMs:
        measurement.dnsLatencyMs,
      jitterMs:
        measurement.jitterMs,
      packetLoss:
        measurement.packetLoss,
      downloadMbps:
        this.lastDownloadMbps,
      uploadMbps: null,
      activeAdapter,
      adapters,
      computer: {
        hostname: hostname(),
        platform: platform(),
        uptimeSeconds:
          Math.round(uptime()),
      },
      booster:
        this.settings,
      measurementSource:
        measurement.source,
      timestamp:
        measurement.timestamp,
    };
  }

  @Post('api/speed-test')
  async runSpeedTest() {
    const url =
      'https://speed.cloudflare.com/__down?bytes=5000000';

    const started =
      performance.now();

    const response = await fetch(
      url,
      {
        cache: 'no-store',
        signal:
          AbortSignal.timeout(
            20000,
          ),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Speed test failed: HTTP ${response.status}`,
      );
    }

    const bytes = (
      await response.arrayBuffer()
    ).byteLength;

    const seconds =
      (performance.now() -
        started) /
      1000;

    this.lastDownloadMbps =
      Number(
        (
          (bytes * 8) /
          seconds /
          1_000_000
        ).toFixed(2),
      );

    return {
      downloadMbps:
        this.lastDownloadMbps,
      testedBytes: bytes,
      timestamp:
        new Date().toISOString(),
    };
  }

  @Post('api/optimization')
  async applyOptimization(
    @Body()
    input: OptimizationRequest,
  ) {
    const mode =
      input.mode ?? 'balanced';

    const dnsProfile =
      input.dnsProfile ??
      'automatic';

    this.settings = {
      ...this.settings,
      mode,
      dnsProfile,
    };

    const result =
      await this.applyWindowsDns(
        dnsProfile,
      );

    return {
      success: true,
      dnsApplied:
        result.applied,
      settings:
        this.settings,
      message:
        result.applied
          ? 'NNIT optimization profile applied.'
          : `Profile saved. ${result.message}`,
    };
  }

  private getAdapters() {
    return Object.entries(
      networkInterfaces(),
    ).flatMap(
      ([name, interfaces]) =>
        (interfaces ?? [])
          .filter(
            (item) =>
              item.family ===
                'IPv4' &&
              !item.internal,
          )
          .map((item) => ({
            name,
            ipv4:
              item.address,
            netmask:
              item.netmask,
            mac:
              item.mac,
          })),
    );
  }

  private selectActiveAdapter(
    adapters: Array<{
      name: string;
      ipv4: string;
      netmask: string;
      mac: string;
    }>,
  ) {
    return (
      adapters.find((adapter) =>
        adapter.name
          .toLowerCase()
          .includes('wi-fi'),
      ) ??
      adapters.find((adapter) => {
        const name =
          adapter.name.toLowerCase();

        return (
          !name.includes(
            'vethernet',
          ) &&
          !name.includes(
            'wsl',
          ) &&
          !name.includes(
            'hyper-v',
          )
        );
      }) ??
      adapters[0] ??
      null
    );
  }

  private async applyWindowsDns(
    profile: string,
  ) {
    const profiles: Record<
      string,
      string[]
    > = {
      automatic: [],
      cloudflare: [
        '1.1.1.1',
        '1.0.0.1',
      ],
      google: [
        '8.8.8.8',
        '8.8.4.4',
      ],
      quad9: [
        '9.9.9.9',
        '149.112.112.112',
      ],
    };

    const servers =
      profiles[profile] ??
      profiles.automatic;

    const quoted =
      servers
        .map(
          (server) =>
            `'${server}'`,
        )
        .join(',');

    const lines =
      servers.length
        ? [
            "$ErrorActionPreference='Stop'",
            "Get-NetAdapter | Where-Object { $_.Status -eq 'Up' } | ForEach-Object {",
            `Set-DnsClientServerAddress -InterfaceIndex $_.ifIndex -ServerAddresses @(${quoted})`,
            '}',
            'Clear-DnsClientCache',
          ]
        : [
            "$ErrorActionPreference='Stop'",
            "Get-NetAdapter | Where-Object { $_.Status -eq 'Up' } | ForEach-Object {",
            'Set-DnsClientServerAddress -InterfaceIndex $_.ifIndex -ResetServerAddresses',
            '}',
            'Clear-DnsClientCache',
          ];

    try {
      await execFileAsync(
        'powershell.exe',
        [
          '-NoProfile',
          '-ExecutionPolicy',
          'Bypass',
          '-Command',
          lines.join(
            String.fromCharCode(
              10,
            ),
          ),
        ],
        {
          timeout: 15000,
          windowsHide: true,
        },
      );

      return {
        applied: true,
        message:
          'Windows DNS updated.',
      };
    } catch {
      return {
        applied: false,
        message:
          'Administrator rights are required to change Windows DNS.',
      };
    }
  }
}
