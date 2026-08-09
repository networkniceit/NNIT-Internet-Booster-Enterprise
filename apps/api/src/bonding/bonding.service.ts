import { Injectable } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { networkInterfaces, platform } from 'node:os';
import { promisify } from 'node:util';
import { BondingLink, BondingSettings } from './bonding.types';
const execFileAsync = promisify(execFile);
@Injectable()
export class BondingService {
  private settings: BondingSettings = {
    enabled: false,
    strategy: 'failover',
    relayHost: '',
    relayPort: 51820,
    encryption: true,
  };
  getSettings() { return this.settings; }
  updateSettings(input: Partial<BondingSettings>) {
    this.settings = {
      ...this.settings,
      ...input,
      relayPort: Math.max(1, Math.min(65535, Number(input.relayPort ?? this.settings.relayPort))),
    };
    return this.settings;
  }
  async getStatus() {
    const links = await this.inspectLinks();
    const eligibleLinks = links.filter((link) => link.eligible);
    const readyForRelay = eligibleLinks.length >= 2 && Boolean(this.settings.relayHost) && this.settings.relayPort > 0;
    return {
      enabled: this.settings.enabled,
      strategy: this.settings.strategy,
      relayConfigured: Boolean(this.settings.relayHost),
      readyForRelay,
      independentLinksDetected: eligibleLinks.length,
      links,
      recommendation: eligibleLinks.length < 2
        ? 'Connect at least two independent internet links, such as Wi-Fi plus Ethernet or USB 4G/5G tethering.'
        : !this.settings.relayHost
          ? 'Two eligible links detected. Configure the NNIT relay server to enable encrypted multi-link transport.'
          : 'Local system is ready for relay-assisted bonding.',
      timestamp: new Date().toISOString(),
    };
  }
  private async inspectLinks(): Promise<BondingLink[]> {
    if (platform() === 'win32') {
      try { return await this.inspectWindowsLinks(); } catch {}
    }
    return Object.entries(networkInterfaces()).flatMap(([name, values]) =>
      (values ?? []).filter((item) => item.family === 'IPv4' && !item.internal).map((item) => {
        const virtual = this.isVirtual(name);
        return { name, ipv4: item.address, mac: item.mac, virtual, connected: true, latencyMs: null, packetLoss: 0, score: virtual ? 0 : 50, eligible: !virtual };
      }),
    );
  }
  private async inspectWindowsLinks(): Promise<BondingLink[]> {
    const script = [
      "$ErrorActionPreference='Stop'",
      "$adapters = @(Get-NetAdapter | Where-Object { $_.Status -eq 'Up' })",
      "$configs = @(Get-NetIPConfiguration)",
      "$result = foreach ($adapter in $adapters) {",
      "  $config = $configs | Where-Object { $_.InterfaceIndex -eq $adapter.ifIndex } | Select-Object -First 1",
      "  $ipv4 = $config.IPv4Address.IPAddress | Select-Object -First 1",
      "  $gateway = $config.IPv4DefaultGateway.NextHop | Select-Object -First 1",
      "  $latency = $null",
      "  $loss = 100",
      "  if ($gateway) {",
      "    $responses = @(Test-Connection -ComputerName $gateway -Count 2 -ErrorAction SilentlyContinue)",
      "    if ($responses.Count -gt 0) {",
      "      $values = @($responses | ForEach-Object { if ($null -ne $_.Latency) { [double]$_.Latency } elseif ($null -ne $_.ResponseTime) { [double]$_.ResponseTime } })",
      "      if ($values.Count -gt 0) { $latency = ($values | Measure-Object -Average).Average }",
      "      $loss = [math]::Round((1 - ($responses.Count / 2)) * 100, 0)",
      "    }",
      "  }",
      "  [pscustomobject]@{ name=$adapter.Name; ipv4=$ipv4; mac=$adapter.MacAddress; gateway=$gateway; latencyMs=$latency; packetLoss=$loss; connected=$true }",
      "}",
      "@($result) | ConvertTo-Json -Compress -Depth 5",
    ].join(String.fromCharCode(10));
    const result = await execFileAsync('powershell.exe', ['-NoProfile','-ExecutionPolicy','Bypass','-Command',script], { timeout: 20000, windowsHide: true, maxBuffer: 4194304 });
    const parsed = JSON.parse(result.stdout.trim()) as any;
    const values = Array.isArray(parsed) ? parsed : [parsed];
    return values.map((item: any) => {
      const virtual = this.isVirtual(item.name);
      const latencyMs = item.latencyMs === null ? null : Math.max(1, Math.round(Number(item.latencyMs)));
      const packetLoss = Math.max(0, Math.min(100, Number(item.packetLoss ?? 100)));
      const score = this.calculateLinkScore(item.connected, latencyMs, packetLoss, virtual);
      return { name: item.name, ipv4: item.ipv4, mac: item.mac, virtual, connected: item.connected, latencyMs, packetLoss, score, eligible: item.connected && !virtual && Boolean(item.gateway) };
    });
  }
  private isVirtual(name: string) {
    const value = name.toLowerCase();
    return value.includes('vethernet') || value.includes('wsl') || value.includes('hyper-v') || value.includes('virtual') || value.includes('loopback');
  }
  private calculateLinkScore(connected: boolean, latencyMs: number | null, packetLoss: number, virtual: boolean) {
    if (!connected || virtual) return 0;
    let score = 100;
    if (latencyMs !== null) score -= Math.min(45, Math.max(0, latencyMs - 10) * 0.35);
    score -= Math.min(50, packetLoss * 8);
    return Math.max(0, Math.round(score));
  }
}
