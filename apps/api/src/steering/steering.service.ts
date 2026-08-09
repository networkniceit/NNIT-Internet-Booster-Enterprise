import { Injectable } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { networkInterfaces, platform } from 'node:os';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

interface SteeringLink {
  name: string;
  ipv4: string | null;
  gateway: string | null;
  metric: number | null;
  latencyMs: number | null;
  jitterMs: number | null;
  packetLoss: number;
  score: number;
  eligible: boolean;
  selected: boolean;
}

@Injectable()
export class SteeringService {
  private automatic = false;
  private minimumImprovement = 8;
  private selectedAdapter = '';

  private cachedLinks: SteeringLink[] = [];
  private cacheTime = 0;
  private measurementRunning = false;

  getSettings() {
    return {
      automatic: this.automatic,
      minimumImprovement: this.minimumImprovement,
      selectedAdapter: this.selectedAdapter,
    };
  }

  updateSettings(input: {
    automatic?: boolean;
    minimumImprovement?: number;
  }) {
    if (typeof input.automatic === 'boolean') {
      this.automatic = input.automatic;
    }

    if (input.minimumImprovement !== undefined) {
      this.minimumImprovement = Math.max(
        0,
        Math.min(100, Number(input.minimumImprovement)),
      );
    }

    return this.getSettings();
  }

  async getStatus() {
    const now = Date.now();

    if (
      this.cachedLinks.length === 0 ||
      now - this.cacheTime > 10000
    ) {
      void this.refreshLinks();
    }

    if (this.cachedLinks.length === 0) {
      this.cachedLinks = this.fallbackLinks();
    }

    const eligible = this.cachedLinks
      .filter((link) => link.eligible)
      .sort((a, b) => b.score - a.score);

    const best = eligible[0] ?? null;

    if (
      this.automatic &&
      best &&
      best.name !== this.selectedAdapter
    ) {
      const current = this.cachedLinks.find(
        (link) => link.name === this.selectedAdapter,
      );

      if (
        !current ||
        best.score - current.score >=
          this.minimumImprovement
      ) {
        void this.applyPreferredAdapter(best.name);
      }
    }

    return {
      automatic: this.automatic,
      minimumImprovement:
        this.minimumImprovement,
      bestAdapter: best?.name ?? null,
      selectedAdapter:
        this.selectedAdapter || null,
      links: this.cachedLinks,
      measurementRunning:
        this.measurementRunning,
      timestamp: new Date().toISOString(),
    };
  }

  async applyPreferredAdapter(
    adapterName: string,
  ) {
    if (!adapterName) {
      throw new Error(
        'Adapter name is required.',
      );
    }

    const safeName =
      adapterName.replaceAll("'", "''");

    const command = [
      "$ErrorActionPreference='Stop'",
      "Get-NetIPInterface -AddressFamily IPv4 |",
      "Where-Object { $_.ConnectionState -eq 'Connected' } |",
      "ForEach-Object {",
      `  $metric = if ($_.InterfaceAlias -eq '${safeName}') { 5 } else { 50 }`,
      "  Set-NetIPInterface -InterfaceIndex $_.InterfaceIndex -AddressFamily IPv4 -AutomaticMetric Disabled -InterfaceMetric $metric",
      "}",
    ].join(
      String.fromCharCode(10),
    );

    try {
      await execFileAsync(
        'powershell.exe',
        [
          '-NoProfile',
          '-ExecutionPolicy',
          'Bypass',
          '-Command',
          command,
        ],
        {
          timeout: 10000,
          windowsHide: true,
        },
      );

      this.selectedAdapter = adapterName;
      await this.refreshLinks();

      return {
        applied: true,
        message:
          `${adapterName} is now the preferred Windows route.`,
      };
    } catch {
      return {
        applied: false,
        message:
          'Run the backend from Administrator PowerShell to change route metrics.',
      };
    }
  }

  async restoreAutomaticMetrics() {
    const command = [
      "$ErrorActionPreference='Stop'",
      "Get-NetIPInterface -AddressFamily IPv4 |",
      "Where-Object { $_.ConnectionState -eq 'Connected' } |",
      "ForEach-Object {",
      "  Set-NetIPInterface -InterfaceIndex $_.InterfaceIndex -AddressFamily IPv4 -AutomaticMetric Enabled",
      "}",
    ].join(
      String.fromCharCode(10),
    );

    try {
      await execFileAsync(
        'powershell.exe',
        [
          '-NoProfile',
          '-ExecutionPolicy',
          'Bypass',
          '-Command',
          command,
        ],
        {
          timeout: 10000,
          windowsHide: true,
        },
      );

      this.selectedAdapter = '';
      await this.refreshLinks();

      return {
        restored: true,
        message:
          'Windows automatic interface metrics restored.',
      };
    } catch {
      return {
        restored: false,
        message:
          'Run the backend from Administrator PowerShell.',
      };
    }
  }

  private async refreshLinks() {
    if (this.measurementRunning) {
      return;
    }

    this.measurementRunning = true;

    try {
      this.cachedLinks =
        platform() === 'win32'
          ? await this.readWindowsLinks()
          : this.fallbackLinks();

      this.cacheTime = Date.now();
    } catch {
      this.cachedLinks =
        this.fallbackLinks();

      this.cacheTime = Date.now();
    } finally {
      this.measurementRunning = false;
    }
  }

  private async readWindowsLinks():
    Promise<SteeringLink[]> {
    const command = [
      "$ErrorActionPreference='Stop'",
      "$adapters = @(Get-NetAdapter | Where-Object { $_.Status -eq 'Up' })",
      "$configs = @(Get-NetIPConfiguration)",
      "$interfaces = @(Get-NetIPInterface -AddressFamily IPv4)",
      "$result = foreach ($adapter in $adapters) {",
      "  $config = $configs | Where-Object { $_.InterfaceIndex -eq $adapter.ifIndex } | Select-Object -First 1",
      "  $interface = $interfaces | Where-Object { $_.InterfaceIndex -eq $adapter.ifIndex } | Select-Object -First 1",
      "  [pscustomobject]@{",
      "    name = $adapter.Name",
      "    ipv4 = ($config.IPv4Address.IPAddress | Select-Object -First 1)",
      "    gateway = ($config.IPv4DefaultGateway.NextHop | Select-Object -First 1)",
      "    metric = $interface.InterfaceMetric",
      "  }",
      "}",
      "@($result) | ConvertTo-Json -Compress -Depth 5",
    ].join(
      String.fromCharCode(10),
    );

    const result = await execFileAsync(
      'powershell.exe',
      [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        command,
      ],
      {
        timeout: 10000,
        windowsHide: true,
        maxBuffer: 4 * 1024 * 1024,
      },
    );

    if (!result.stdout.trim()) {
      return this.fallbackLinks();
    }

    const parsed = JSON.parse(
      result.stdout.trim(),
    );

    const values = Array.isArray(parsed)
      ? parsed
      : [parsed];

    return values.map((item) =>
      this.createLink(
        String(item.name),
        item.ipv4 ?? null,
        item.gateway ?? null,
        item.metric === null
          ? null
          : Number(item.metric),
      ),
    );
  }

  private fallbackLinks():
    SteeringLink[] {
    return Object.entries(
      networkInterfaces(),
    ).flatMap(([name, addresses]) =>
      (addresses ?? [])
        .filter(
          (address) =>
            address.family === 'IPv4' &&
            !address.internal,
        )
        .map((address) =>
          this.createLink(
            name,
            address.address,
            null,
            null,
          ),
        ),
    );
  }

  private createLink(
    name: string,
    ipv4: string | null,
    gateway: string | null,
    metric: number | null,
  ): SteeringLink {
    const normalized =
      name.toLowerCase();

    const virtual =
      normalized.includes('vethernet') ||
      normalized.includes('wsl') ||
      normalized.includes('hyper-v') ||
      normalized.includes('virtual') ||
      normalized.includes('loopback');

    const eligible =
      !virtual &&
      Boolean(ipv4);

    let score = eligible ? 75 : 0;

    if (eligible && gateway) {
      score += 10;
    }

    if (
      eligible &&
      normalized.includes('ethernet')
    ) {
      score += 5;
    }

    if (
      eligible &&
      metric !== null
    ) {
      score += Math.max(
        0,
        Math.min(10, 10 - metric / 10),
      );
    }

    return {
      name,
      ipv4,
      gateway,
      metric,
      latencyMs: null,
      jitterMs: null,
      packetLoss: 0,
      score: Math.max(
        0,
        Math.min(100, Math.round(score)),
      ),
      eligible,
      selected:
        this.selectedAdapter === name,
    };
  }
}
