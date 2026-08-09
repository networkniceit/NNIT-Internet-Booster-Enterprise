import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

interface ProcessTraffic {
  pid: number;
  name: string;
  path: string | null;
  connectionCount: number;
  establishedCount: number;
  listeningCount: number;
  remoteEndpoints: string[];
}

interface InterfaceCounters {
  interfaceName: string;
  received: number;
  sent: number;
  timestamp: number;
}

interface TrafficSnapshot {
  timestamp: string;
  interfaceName: string | null;
  downloadMbps: number | null;
  uploadMbps: number | null;
  totalMbps: number | null;
  processes: ProcessTraffic[];
}

@Injectable()
export class TrafficService
  implements OnModuleInit, OnModuleDestroy
{
  private timer: NodeJS.Timeout | null = null;
  private refreshRunning = false;

  private previousCounters:
    | InterfaceCounters
    | null = null;

  private latest: TrafficSnapshot = {
    timestamp: new Date().toISOString(),
    interfaceName: null,
    downloadMbps: null,
    uploadMbps: null,
    totalMbps: null,
    processes: [],
  };

  onModuleInit() {
    void this.refresh();

    this.timer = setInterval(() => {
      void this.refresh();
    }, 3000);

    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  getLatest(): TrafficSnapshot {
    return this.latest;
  }

  async refresh(): Promise<TrafficSnapshot> {
    if (this.refreshRunning) {
      return this.latest;
    }

    this.refreshRunning = true;

    try {
      const [processes, counters] =
        await Promise.all([
          this.readConnections(),
          this.readInterfaceCounters(),
        ]);

      let downloadMbps: number | null = null;
      let uploadMbps: number | null = null;

      if (
        counters &&
        this.previousCounters &&
        counters.interfaceName ===
          this.previousCounters.interfaceName
      ) {
        const seconds =
          (counters.timestamp -
            this.previousCounters.timestamp) /
          1000;

        if (seconds > 0) {
          const receivedBytes = Math.max(
            0,
            counters.received -
              this.previousCounters.received,
          );

          const sentBytes = Math.max(
            0,
            counters.sent -
              this.previousCounters.sent,
          );

          downloadMbps = Number(
            (
              (receivedBytes * 8) /
              seconds /
              1_000_000
            ).toFixed(2),
          );

          uploadMbps = Number(
            (
              (sentBytes * 8) /
              seconds /
              1_000_000
            ).toFixed(2),
          );
        }
      }

      if (counters) {
        this.previousCounters = counters;
      }

      this.latest = {
        timestamp: new Date().toISOString(),
        interfaceName:
          counters?.interfaceName ?? null,
        downloadMbps,
        uploadMbps,
        totalMbps:
          downloadMbps !== null &&
          uploadMbps !== null
            ? Number(
                (
                  downloadMbps +
                  uploadMbps
                ).toFixed(2),
              )
            : null,
        processes,
      };

      return this.latest;
    } finally {
      this.refreshRunning = false;
    }
  }

  private async readConnections():
    Promise<ProcessTraffic[]> {
    try {
      const output = await execFileAsync(
        'netstat.exe',
        ['-ano', '-p', 'tcp'],
        {
          timeout: 30000,
          windowsHide: true,
          maxBuffer: 8 * 1024 * 1024,
        },
      );

      const grouped = new Map<
        number,
        {
          connections: number;
          established: number;
          listening: number;
          remoteEndpoints: Set<string>;
        }
      >();

      for (
        const line of output.stdout.split(
          /\r?\n/,
        )
      ) {
        const match = line
          .trim()
          .match(
            /^TCP\s+(\S+)\s+(\S+)\s+(\S+)\s+(\d+)$/i,
          );

        if (!match) {
          continue;
        }

        const remoteEndpoint = match[2];
        const state =
          match[3].toUpperCase();
        const pid = Number(match[4]);

        if (
          !Number.isInteger(pid) ||
          pid <= 0
        ) {
          continue;
        }

        const current =
          grouped.get(pid) ?? {
            connections: 0,
            established: 0,
            listening: 0,
            remoteEndpoints:
              new Set<string>(),
          };

        current.connections += 1;

        if (state === 'ESTABLISHED') {
          current.established += 1;
        }

        if (state === 'LISTENING') {
          current.listening += 1;
        }

        if (
          remoteEndpoint !==
            '0.0.0.0:0' &&
          remoteEndpoint !== '[::]:0'
        ) {
          current.remoteEndpoints.add(
            remoteEndpoint,
          );
        }

        grouped.set(pid, current);
      }

      const processData =
        await this.readProcessDetails(
          [...grouped.keys()],
        );

      return [...grouped.entries()]
        .map(([pid, connection]) => {
          const process =
            processData.get(pid);

          return {
            pid,
            name:
              process?.name ??
              `PID ${pid}`,
            path:
              process?.path ?? null,
            connectionCount:
              connection.connections,
            establishedCount:
              connection.established,
            listeningCount:
              connection.listening,
            remoteEndpoints: [
              ...connection.remoteEndpoints,
            ].slice(0, 20),
          };
        })
        .sort(
          (a, b) =>
            b.connectionCount -
            a.connectionCount,
        );
    } catch (error) {
      console.warn(
        'Traffic connection scan failed:',
        error,
      );

      return [];
    }
  }

  private async readProcessDetails(
    processIds: number[],
  ) {
    const result = new Map<
      number,
      {
        name: string;
        path: string | null;
      }
    >();

    if (!processIds.length) {
      return result;
    }

    for (
      let index = 0;
      index < processIds.length;
      index += 40
    ) {
      const batch = processIds.slice(
        index,
        index + 40,
      );

      const script = [
        "$ErrorActionPreference='SilentlyContinue'",
        `$ids=@(${batch.join(',')})`,
        '$result=foreach($idValue in $ids){',
        '  $process=Get-Process -Id $idValue -ErrorAction SilentlyContinue',
        '  if($process){',
        '    $path=$null',
        '    try{$path=$process.Path}catch{}',
        '    [pscustomobject]@{',
        '      pid=$idValue',
        '      name=$process.ProcessName',
        '      path=$path',
        '    }',
        '  }',
        '}',
        '@($result)|ConvertTo-Json -Compress -Depth 4',
      ].join(
        String.fromCharCode(10),
      );

      try {
        const output =
          await execFileAsync(
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
              maxBuffer:
                4 * 1024 * 1024,
            },
          );

        if (!output.stdout.trim()) {
          continue;
        }

        const parsed = JSON.parse(
          output.stdout.trim(),
        );

        const values = Array.isArray(
          parsed,
        )
          ? parsed
          : [parsed];

        for (const item of values) {
          result.set(
            Number(item.pid),
            {
              name: String(item.name),
              path: item.path
                ? String(item.path)
                : null,
            },
          );
        }
      } catch {
        // Keep PID fallback.
      }
    }

    return result;
  }

  private async readInterfaceCounters():
    Promise<InterfaceCounters | null> {
    const script = [
      "$ErrorActionPreference='Stop'",
      '$adapter = Get-NetAdapter |',
      "  Where-Object { $_.Status -eq 'Up' -and $_.Name -notmatch 'vEthernet|WSL|Hyper-V|Loopback|Virtual' } |",
      "  Sort-Object @{Expression={if($_.Name -match 'Wi-Fi|WLAN'){0}else{1}}} |",
      '  Select-Object -First 1',
      'if(-not $adapter){exit 2}',
      '$statistics = Get-NetAdapterStatistics -Name $adapter.Name',
      '[pscustomobject]@{',
      '  interfaceName = $adapter.Name',
      '  received = [double]$statistics.ReceivedBytes',
      '  sent = [double]$statistics.SentBytes',
      '  timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()',
      '} | ConvertTo-Json -Compress',
    ].join(
      String.fromCharCode(10),
    );

    try {
      const output = await execFileAsync(
        'powershell.exe',
        [
          '-NoProfile',
          '-ExecutionPolicy',
          'Bypass',
          '-Command',
          script,
        ],
        {
          timeout: 30000,
          windowsHide: true,
        },
      );

      if (!output.stdout.trim()) {
        return null;
      }

      const value = JSON.parse(
        output.stdout.trim(),
      );

      return {
        interfaceName: String(
          value.interfaceName,
        ),
        received: Number(
          value.received,
        ),
        sent: Number(value.sent),
        timestamp: Number(
          value.timestamp,
        ),
      };
    } catch (error) {
      console.warn(
        'Traffic counter scan failed:',
        error,
      );

      return null;
    }
  }
}



