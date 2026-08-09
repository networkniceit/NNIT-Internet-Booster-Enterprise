import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import crypto from 'node:crypto';
import { MeasurementService } from '../measurement/measurement.service';
import { RelayClientService } from '../relay-client/relay-client.service';
import {
  AlertItem,
  AlertSettings,
} from './alerts.types';

@Injectable()
export class AlertsService
  implements OnModuleInit, OnModuleDestroy
{
  private timer: NodeJS.Timeout | null = null;
  private items: AlertItem[] = [];

  private settings: AlertSettings = {
    enabled: true,
    latencyThresholdMs: 180,
    dnsThresholdMs: 250,
    jitterThresholdMs: 80,
    packetLossThreshold: 5,
    scoreThreshold: 45,
    relayRequired: true,
    cooldownSeconds: 60,
  };

  constructor(
    private readonly measurement:
      MeasurementService,
    private readonly relay:
      RelayClientService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      this.evaluate();
    }, 5000);

    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  getStatus() {
    return {
      settings: this.settings,
      active: this.items.filter(
        (item) => !item.acknowledged,
      ),
      history: this.items
        .slice(-100)
        .reverse(),
      timestamp: new Date().toISOString(),
    };
  }

  updateSettings(
    input: Partial<AlertSettings>,
  ) {
    this.settings = {
      ...this.settings,
      ...input,
      latencyThresholdMs: Math.max(
        1,
        Number(
          input.latencyThresholdMs ??
            this.settings.latencyThresholdMs,
        ),
      ),
      dnsThresholdMs: Math.max(
        1,
        Number(
          input.dnsThresholdMs ??
            this.settings.dnsThresholdMs,
        ),
      ),
      jitterThresholdMs: Math.max(
        1,
        Number(
          input.jitterThresholdMs ??
            this.settings.jitterThresholdMs,
        ),
      ),
      packetLossThreshold: Math.max(
        0,
        Math.min(
          100,
          Number(
            input.packetLossThreshold ??
              this.settings.packetLossThreshold,
          ),
        ),
      ),
      scoreThreshold: Math.max(
        0,
        Math.min(
          100,
          Number(
            input.scoreThreshold ??
              this.settings.scoreThreshold,
          ),
        ),
      ),
    };

    return this.settings;
  }

  acknowledge(id: string) {
    const item = this.items.find(
      (entry) => entry.id === id,
    );

    if (item) {
      item.acknowledged = true;
    }

    return {
      success: Boolean(item),
    };
  }

  clear() {
    this.items = [];

    return {
      success: true,
    };
  }

  evaluate() {
    if (!this.settings.enabled) {
      return this.getStatus();
    }

    const measurement =
      this.measurement.getLatest();

    const relay =
      this.relay.getStatus();

    this.setCondition(
      'offline',
      !measurement.online,
      'critical',
      'Internet offline',
      'No working internet path was detected.',
    );

    this.setCondition(
      'latency',
      measurement.internetTcpLatencyMs !== null &&
        measurement.internetTcpLatencyMs >=
          this.settings.latencyThresholdMs,
      'warning',
      'High internet latency',
      `Internet TCP latency is ${measurement.internetTcpLatencyMs ?? '--'} ms.`,
    );

    this.setCondition(
      'dns',
      measurement.dnsLatencyMs !== null &&
        measurement.dnsLatencyMs >=
          this.settings.dnsThresholdMs,
      'warning',
      'Slow DNS response',
      `DNS latency is ${measurement.dnsLatencyMs ?? '--'} ms.`,
    );

    this.setCondition(
      'jitter',
      measurement.jitterMs !== null &&
        measurement.jitterMs >=
          this.settings.jitterThresholdMs,
      'warning',
      'High network jitter',
      `Measured jitter is ${measurement.jitterMs ?? '--'} ms.`,
    );

    this.setCondition(
      'packet-loss',
      measurement.packetLoss >=
        this.settings.packetLossThreshold &&
        this.settings.packetLossThreshold > 0,
      'critical',
      'Packet loss detected',
      `Packet loss is ${measurement.packetLoss}%.`,
    );

    this.setCondition(
      'score',
      measurement.score <=
        this.settings.scoreThreshold,
      'warning',
      'Low connection score',
      `Unified score is ${measurement.score}.`,
    );

    this.setCondition(
      'relay',
      this.settings.relayRequired &&
        !relay.connected,
      'warning',
      'Relay disconnected',
      'The NNIT relay session is not connected.',
    );

    return this.getStatus();
  }

  private setCondition(
    category: string,
    active: boolean,
    severity: AlertItem['severity'],
    title: string,
    message: string,
  ) {
    const existing = this.items.find(
      (item) =>
        item.category === category &&
        !item.acknowledged,
    );

    if (!active) {
      if (existing) {
        existing.acknowledged = true;
      }

      return;
    }

    if (existing) {
      existing.timestamp =
        new Date().toISOString();
      existing.message = message;
      existing.severity = severity;
      return;
    }

    this.items.push({
      id: crypto.randomUUID(),
      timestamp:
        new Date().toISOString(),
      severity,
      category,
      title,
      message,
      acknowledged: false,
    });

    this.items =
      this.items.slice(-1000);
  }
}
