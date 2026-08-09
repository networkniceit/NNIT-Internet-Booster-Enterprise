import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { MeasurementService } from '../measurement/measurement.service';

@Injectable()
export class OptimizerService
  implements OnModuleInit, OnModuleDestroy
{
  private timer: NodeJS.Timeout | null = null;

  private settings = {
    enabled: true,
    automaticFailover: false,
    minimumScore: 45,
    preferredAdapter: '',
    probeIntervalMs: 5000,
  };

  constructor(
    private readonly measurement:
      MeasurementService,
  ) {}

  onModuleInit() {
    this.startTimer();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  getLatest() {
    const latest =
      this.measurement.getLatest();

    return {
      ...latest,

      // Compatibility fields used by
      // the existing dashboard.
      latencyMs:
        latest.internetTcpLatencyMs,

      settings: this.settings,
    };
  }

  getHistory() {
    return this.measurement
      .getHistory(120)
      .map((point) => ({
        ...point,
        latencyMs:
          point.internetTcpLatencyMs,
      }));
  }

  getSettings() {
    return this.settings;
  }

  updateSettings(
    input: Partial<
      typeof this.settings
    >,
  ) {
    this.settings = {
      ...this.settings,
      ...input,

      minimumScore: Math.max(
        1,
        Math.min(
          100,
          Number(
            input.minimumScore ??
              this.settings.minimumScore,
          ),
        ),
      ),

      probeIntervalMs: Math.max(
        2000,
        Number(
          input.probeIntervalMs ??
            this.settings.probeIntervalMs,
        ),
      ),
    };

    this.startTimer();

    return this.settings;
  }

  private startTimer() {
    if (this.timer) {
      clearInterval(this.timer);
    }

    this.timer = setInterval(() => {
      void this.measurement.refresh();
    }, this.settings.probeIntervalMs);

    this.timer.unref();
  }
}
