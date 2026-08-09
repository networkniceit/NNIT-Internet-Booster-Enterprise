import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

@Injectable()
export class RemoteDiagnosticsService
  implements OnModuleInit, OnModuleDestroy
{
  private timer: NodeJS.Timeout | null = null;

  private cachedWindows: any = {
    activeAdapter: null,
    defaultGateway: null,
    diskFreeBytes: null,
    diskTotalBytes: null,
    cpuPercent: null,
    sampledAt: null,
  };

  private refreshInFlight = false;

  onModuleInit() {
    void this.refreshWindowsSnapshot();

    this.timer = setInterval(
      () => {
        void this.refreshWindowsSnapshot();
      },
      15000,
    );

    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async telemetry() {
    const totalMemoryBytes = os.totalmem();
    const freeMemoryBytes = os.freemem();

    const memoryUsedPercent =
      totalMemoryBytes > 0
        ? Number(
            (
              ((totalMemoryBytes - freeMemoryBytes) /
                totalMemoryBytes) *
              100
            ).toFixed(1),
          )
        : null;

    return {
      hostname: os.hostname(),
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      uptimeSeconds: Math.round(os.uptime()),
      cpuPercent: this.cachedWindows.cpuPercent,
      memoryUsedPercent,
      totalMemoryBytes,
      freeMemoryBytes,
      systemDriveFreeBytes:
        this.cachedWindows.diskFreeBytes,
      systemDriveTotalBytes:
        this.cachedWindows.diskTotalBytes,
      sampledAt:
        this.cachedWindows.sampledAt,
      timestamp: new Date().toISOString(),
    };
  }

  async runDiagnostics() {
    // Explicit diagnostic runs are allowed to wait for one fresh sample.
    await this.refreshWindowsSnapshot(true);

    const notes: string[] = [];

    const activeAdapter =
      this.cachedWindows.activeAdapter ?? null;

    const defaultGateway =
      this.cachedWindows.defaultGateway ?? null;

    let dnsResolved = false;

    try {
      const dns = await import('node:dns');

      const result = await Promise.race([
        dns.promises.resolve4('one.one.one.one'),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('DNS timeout')),
            5000,
          ),
        ),
      ]);

      dnsResolved =
        Array.isArray(result) &&
        result.length > 0;
    } catch {
      notes.push('DNS resolution test failed.');
    }

    let internetReachable = false;

    try {
      const response = await fetch(
        'https://www.msftconnecttest.com/connecttest.txt',
        {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        },
      );

      internetReachable =
        response.ok ||
        response.status > 0;
    } catch {
      notes.push('Internet reachability test failed.');
    }

    if (!activeAdapter) {
      notes.push('Active physical adapter could not be resolved.');
    }

    if (!defaultGateway) {
      notes.push('IPv4 default gateway could not be resolved.');
    }

    return {
      healthy:
        Boolean(activeAdapter) &&
        Boolean(defaultGateway) &&
        dnsResolved &&
        internetReachable,
      dnsResolved,
      internetReachable,
      defaultGateway,
      activeAdapter,
      cloudReachable: null,
      notes,
      timestamp: new Date().toISOString(),
    };
  }

  async collectSummary() {
    return {
      telemetry: await this.telemetry(),
      diagnostics: await this.runDiagnostics(),
      generatedAt: new Date().toISOString(),
    };
  }

  private async refreshWindowsSnapshot(force = false) {
    if (this.refreshInFlight && !force) {
      return;
    }

    this.refreshInFlight = true;

    const script = `
$ErrorActionPreference='SilentlyContinue'

$adapter = Get-CimInstance Win32_NetworkAdapterConfiguration |
  Where-Object {
    $_.IPEnabled -eq $true -and
    $_.Description -notmatch 'Hyper-V|Virtual|Loopback|WSL|vEthernet'
  } |
  Sort-Object @{
    Expression = {
      if($_.Description -match 'Wi-Fi|Wireless|WLAN'){0}else{1}
    }
  } |
  Select-Object -First 1

$gateway = $null
if($adapter -and $adapter.DefaultIPGateway){
  $gateway = @($adapter.DefaultIPGateway)[0]
}

$disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'" |
  Select-Object -First 1

$cpu = Get-CimInstance Win32_Processor |
  Measure-Object -Property LoadPercentage -Average

[pscustomobject]@{
  activeAdapter = if($adapter){[string]$adapter.Description}else{$null}
  defaultGateway = if($gateway){[string]$gateway}else{$null}
  diskFreeBytes = if($disk){[double]$disk.FreeSpace}else{$null}
  diskTotalBytes = if($disk){[double]$disk.Size}else{$null}
  cpuPercent = if($cpu.Count -gt 0){[double]$cpu.Average}else{$null}
  sampledAt = [DateTimeOffset]::UtcNow.ToString('o')
} | ConvertTo-Json -Compress
`;

    try {
      const { stdout } = await execFileAsync(
        'powershell.exe',
        [
          '-NoProfile',
          '-ExecutionPolicy',
          'Bypass',
          '-Command',
          script,
        ],
        {
          timeout: 8000,
          windowsHide: true,
        },
      );

      const text = stdout.trim();

      if (text) {
        const parsed = JSON.parse(text);

        this.cachedWindows = {
          ...this.cachedWindows,
          ...parsed,
        };
      }
    } catch {
      // Keep the last good snapshot rather than blocking/failing the API.
    } finally {
      this.refreshInFlight = false;
    }
  }
}
