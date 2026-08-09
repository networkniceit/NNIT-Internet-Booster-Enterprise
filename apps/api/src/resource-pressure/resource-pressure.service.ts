import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import os from 'node:os';
import {
  existsSync,
  readFileSync,
} from 'node:fs';
import { join } from 'node:path';

@Injectable()
export class ResourcePressureService
  implements OnModuleInit, OnModuleDestroy
{
  private previousCpu:
    | { idle: number; total: number }
    | null = null;

  private timer: NodeJS.Timeout | null = null;

  private lastAlertSignature = '';
  private lastAlertAt = 0;

  private readonly cloudSettingsFile =
    join(
      process.cwd(),
      'data',
      'cloud-agent.json',
    );

  onModuleInit() {
    this.timer = setInterval(
      () => {
        void this.evaluateCloudAlert()
          .catch(() => undefined);
      },
      30000,
    );

    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  status() {
    const cpuPercent = this.readCpuPercent();

    const totalMemory =
      os.totalmem();

    const freeMemory =
      os.freemem();

    const memoryUsedPercent =
      totalMemory > 0
        ? Number(
            (
              ((totalMemory - freeMemory) /
                totalMemory) *
              100
            ).toFixed(1),
          )
        : null;

    const freeMemoryGb =
      Number(
        (
          freeMemory /
          1024 /
          1024 /
          1024
        ).toFixed(2),
      );

    const totalMemoryGb =
      Number(
        (
          totalMemory /
          1024 /
          1024 /
          1024
        ).toFixed(2),
      );

    const warnings: string[] = [];

    if (
      cpuPercent !== null &&
      cpuPercent >= 90
    ) {
      warnings.push(
        'CPU pressure is critical.',
      );
    } else if (
      cpuPercent !== null &&
      cpuPercent >= 75
    ) {
      warnings.push(
        'CPU pressure is high.',
      );
    }

    if (
      memoryUsedPercent !== null &&
      memoryUsedPercent >= 90
    ) {
      warnings.push(
        'Memory pressure is critical.',
      );
    } else if (
      freeMemoryGb < 4
    ) {
      warnings.push(
        'Available RAM is low.',
      );
    }

    const pressure =
      warnings.length >= 2
        ? 'critical'
        : warnings.length === 1
        ? 'warning'
        : 'normal';

    return {
      cpuPercent,
      memoryUsedPercent,
      freeMemoryGb,
      totalMemoryGb,
      pressure,
      warnings,
      timestamp:
        new Date().toISOString(),
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
      this.previousCpu = {
        idle,
        total,
      };

      return null;
    }

    const idleDelta =
      idle -
      this.previousCpu.idle;

    const totalDelta =
      total -
      this.previousCpu.total;

    this.previousCpu = {
      idle,
      total,
    };

    if (totalDelta <= 0) {
      return null;
    }

    return Number(
      (
        (1 -
          idleDelta /
            totalDelta) *
        100
      ).toFixed(1),
    );
  }

  private async evaluateCloudAlert() {
    const current =
      this.status();

    if (
      current.pressure === 'normal' ||
      current.warnings.length === 0
    ) {
      this.lastAlertSignature = '';
      return;
    }

    const signature =
      current.warnings.join('|');

    const now = Date.now();

    const cooldownMs =
      5 * 60 * 1000;

    if (
      signature ===
        this.lastAlertSignature &&
      now - this.lastAlertAt <
        cooldownMs
    ) {
      return;
    }

    const cloud =
      this.readCloudSettings();

    if (!cloud) {
      return;
    }

    const severity =
      current.pressure === 'critical'
        ? 'critical'
        : 'warning';

    const message =
      [
        ...current.warnings,
        `CPU: ${
          current.cpuPercent ??
          '--'
        }%.`,
        `Memory: ${
          current.memoryUsedPercent ??
          '--'
        }%.`,
        `Free RAM: ${
          current.freeMemoryGb
        } GB.`,
      ].join(' ');

    const response =
      await fetch(
        `${cloud.cloudUrl}/api/alerts`,
        {
          method: 'POST',
          headers: {
            'content-type':
              'application/json',
            'x-nnit-api-key':
              cloud.apiKey,
          },
          body: JSON.stringify({
            deviceId:
              cloud.deviceId,
            type:
              'resource-pressure',
            severity,
            message,
          }),
          signal:
            AbortSignal.timeout(
              15000,
            ),
        },
      );

    if (!response.ok) {
      throw new Error(
        `Cloud alert ${
          response.status
        }: ${await response.text()}`,
      );
    }

    this.lastAlertSignature =
      signature;

    this.lastAlertAt = now;
  }

  private readCloudSettings():
    | {
        cloudUrl: string;
        apiKey: string;
        deviceId: string;
      }
    | null {
    try {
      if (
        !existsSync(
          this.cloudSettingsFile,
        )
      ) {
        return null;
      }

      const value =
        JSON.parse(
          readFileSync(
            this.cloudSettingsFile,
            'utf8',
          ),
        );

      const cloudUrl =
        String(
          value.cloudUrl ?? '',
        ).replace(/\/+$/, '');

      const apiKey =
        String(
          value.apiKey ?? '',
        );

      const deviceId =
        String(
          value.deviceId ?? '',
        );

      if (
        !cloudUrl ||
        !apiKey ||
        !deviceId
      ) {
        return null;
      }

      return {
        cloudUrl,
        apiKey,
        deviceId,
      };
    } catch {
      return null;
    }
  }
}
