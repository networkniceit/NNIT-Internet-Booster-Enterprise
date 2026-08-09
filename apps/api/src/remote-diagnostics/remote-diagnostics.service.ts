import { Injectable } from '@nestjs/common';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  DiagnosticResult,
  SystemTelemetry,
} from './remote-diagnostics.types';

const execFileAsync = promisify(execFile);

@Injectable()
export class RemoteDiagnosticsService {
  private previousCpu:
    | { idle: number; total: number }
    | null = null;

  async telemetry(): Promise<SystemTelemetry> {
    const cpuPercent = this.readCpuPercent();

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

    const drive = await this.readSystemDrive();

    return {
      hostname: os.hostname(),
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      uptimeSeconds: Math.round(os.uptime()),
      cpuPercent,
      memoryUsedPercent,
      totalMemoryBytes,
      freeMemoryBytes,
      systemDriveFreeBytes: drive?.free ?? null,
      systemDriveTotalBytes: drive?.total ?? null,
      timestamp: new Date().toISOString(),
    };
  }

  async runDiagnostics(): Promise<DiagnosticResult> {
    const notes: string[] = [];

    const activeAdapter =
      await this.runPowerShell(
        "$a=Get-NetAdapter|Where-Object{$_.Status -eq 'Up' -and $_.Name -notmatch 'vEthernet|WSL|Hyper-V|Loopback|Virtual'}|Select-Object -First 1 -ExpandProperty Name; if($a){$a}",
      );

    const defaultGateway =
      await this.runPowerShell(
        "$g=(Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue|Sort-Object RouteMetric|Select-Object -First 1).NextHop; if($g){$g}",
      );

    let dnsResolved = false;
    try {
      const { stdout } = await execFileAsync(
        'powershell.exe',
        [
          '-NoProfile',
          '-ExecutionPolicy',
          'Bypass',
          '-Command',
          "Resolve-DnsName one.one.one.one -ErrorAction Stop | Out-Null; 'OK'",
        ],
        { timeout: 10000, windowsHide: true },
      );
      dnsResolved = stdout.includes('OK');
    } catch {
      notes.push('DNS resolution test failed.');
    }

    let internetReachable = false;
    try {
      const response = await fetch(
        'https://1.1.1.1',
        {
          method: 'HEAD',
          signal: AbortSignal.timeout(10000),
        },
      );
      internetReachable = response.ok || response.status > 0;
    } catch {
      notes.push('Internet reachability test failed.');
    }

    if (!activeAdapter) {
      notes.push('No physical active adapter detected.');
    }

    if (!defaultGateway) {
      notes.push('No IPv4 default gateway detected.');
    }

    return {
      healthy:
        Boolean(activeAdapter) &&
        Boolean(defaultGateway) &&
        dnsResolved &&
        internetReachable,
      dnsResolved,
      internetReachable,
      defaultGateway:
        defaultGateway || null,
      activeAdapter:
        activeAdapter || null,
      cloudReachable: null,
      notes,
      timestamp: new Date().toISOString(),
    };
  }

  async collectSummary() {
    const telemetry = await this.telemetry();
    const diagnostics = await this.runDiagnostics();

    return {
      telemetry,
      diagnostics,
      generatedAt: new Date().toISOString(),
    };
  }

  private readCpuPercent() {
    const cpus = os.cpus();

    let idle = 0;
    let total = 0;

    for (const cpu of cpus) {
      idle += cpu.times.idle;
      total +=
        cpu.times.user +
        cpu.times.nice +
        cpu.times.sys +
        cpu.times.idle +
        cpu.times.irq;
    }

    if (!this.previousCpu) {
      this.previousCpu = { idle, total };
      return null;
    }

    const idleDelta =
      idle - this.previousCpu.idle;

    const totalDelta =
      total - this.previousCpu.total;

    this.previousCpu = { idle, total };

    if (totalDelta <= 0) {
      return null;
    }

    return Number(
      (
        (1 - idleDelta / totalDelta) *
        100
      ).toFixed(1),
    );
  }

  private async readSystemDrive() {
    const result =
      await this.runPowerShell(
        "$d=Get-CimInstance Win32_LogicalDisk -Filter \"DeviceID='C:'\" -ErrorAction SilentlyContinue; if($d){[pscustomobject]@{free=[double]$d.FreeSpace;total=[double]$d.Size}|ConvertTo-Json -Compress}",
      );

    if (!result) {
      return null;
    }

    try {
      return JSON.parse(result);
    } catch {
      return null;
    }
  }

  private async runPowerShell(
    command: string,
  ): Promise<string> {
    try {
      const { stdout } =
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

      return stdout.trim();
    } catch {
      return '';
    }
  }
}
