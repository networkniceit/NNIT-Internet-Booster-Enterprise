import { Injectable } from '@nestjs/common';
import { MeasurementService } from '../measurement/measurement.service';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly measurement:
      MeasurementService,
  ) {}

  getHistory(limit = 180) {
    return this.measurement.getHistory(
      limit,
    );
  }

  getSummary() {
    const recent =
      this.measurement.getHistory(60);

    const online =
      recent.filter(
        (point) => point.online,
      );

    const latencies =
      online
        .map(
          (point) => point.internetTcpLatencyMs,
        )
        .filter(
          (value): value is number =>
            value !== null,
        );

    return {
      samples: recent.length,
      averageLatency:
        latencies.length
          ? Math.round(
              latencies.reduce(
                (total, value) =>
                  total + value,
                0,
              ) / latencies.length,
            )
          : null,
      averageScore:
        recent.length
          ? Math.round(
              recent.reduce(
                (total, point) =>
                  total + point.score,
                0,
              ) / recent.length,
            )
          : 0,
      uptimePercent:
        recent.length
          ? Number(
              (
                (online.length /
                  recent.length) *
                100
              ).toFixed(2),
            )
          : 0,
      latest:
        recent.at(-1) ?? null,
    };
  }

  getAudit() {
    return [];
  }

  async clearHistory() {
    return this.measurement.clearHistory();
  }

  exportDiagnostics() {
    return {
      generatedAt:
        new Date().toISOString(),
      summary: this.getSummary(),
      history:
        this.getHistory(500),
      audit: [],
    };
  }
}


