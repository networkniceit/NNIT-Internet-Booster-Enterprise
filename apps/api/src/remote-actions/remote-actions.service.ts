import { Injectable } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

@Injectable()
export class RemoteActionsService {
  readonly allowed = [
    'flush-dns',
    'renew-ip',
    'restart-active-adapter',
  ];

  getAllowed() {
    return this.allowed;
  }

  async execute(type: string) {
    if (!this.allowed.includes(type)) {
      return {
        success: false,
        type,
        message: `Unsupported remote action: ${type}`,
        timestamp: new Date().toISOString(),
      };
    }

    try {
      if (type === 'flush-dns') {
        await run(
          'powershell.exe',
          [
            '-NoProfile',
            '-ExecutionPolicy',
            'Bypass',
            '-Command',
            "Clear-DnsClientCache; ipconfig /flushdns | Out-Null",
          ],
          {
            timeout: 15000,
            windowsHide: true,
          },
        );

        return {
          success: true,
          type,
          message: 'DNS cache flushed.',
          timestamp: new Date().toISOString(),
        };
      }

      if (type === 'renew-ip') {
        await run(
          'powershell.exe',
          [
            '-NoProfile',
            '-ExecutionPolicy',
            'Bypass',
            '-Command',
            "ipconfig /renew | Out-Null",
          ],
          {
            timeout: 30000,
            windowsHide: true,
          },
        );

        return {
          success: true,
          type,
          message: 'IP configuration renewed.',
          timestamp: new Date().toISOString(),
        };
      }

      const { stdout } = await run(
        'powershell.exe',
        [
          '-NoProfile',
          '-ExecutionPolicy',
          'Bypass',
          '-Command',
          "$ErrorActionPreference='Stop';$a=Get-NetAdapter|Where-Object{$_.Status -eq 'Up' -and $_.Name -notmatch 'vEthernet|WSL|Hyper-V|Loopback|Virtual'}|Select-Object -First 1;if(-not $a){throw 'No active physical adapter found.'};$n=$a.Name;Disable-NetAdapter -Name $n -Confirm:$false;Start-Sleep -Seconds 2;Enable-NetAdapter -Name $n -Confirm:$false;$n",
        ],
        {
          timeout: 30000,
          windowsHide: true,
        },
      );

      return {
        success: true,
        type,
        message: `Adapter restarted: ${stdout.trim()}`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        type,
        message:
          error instanceof Error
            ? error.message
            : String(error),
        timestamp: new Date().toISOString(),
      };
    }
  }
}
