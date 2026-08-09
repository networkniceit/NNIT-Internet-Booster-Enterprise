import { Injectable } from '@nestjs/common';
import { TrafficService } from '../traffic/traffic.service';
import { QosService } from './qos.service';

@Injectable()
export class QosProfilesService {
  constructor(
    private readonly traffic: TrafficService,
    private readonly qos: QosService,
  ) {}

  getProfiles() {
    return [
      { name: 'balanced', label: 'Balanced' },
      { name: 'gaming', label: 'Gaming' },
      { name: 'video-call', label: 'Video Call' },
      { name: 'streaming', label: 'Streaming' },
      { name: 'development', label: 'Development' },
      {
        name: 'background-downloads',
        label: 'Background Downloads',
      },
    ];
  }

  async preview(name: string) {
    const templates: Record<
      string,
      Array<[string, string]>
    > = {
      balanced: [
        ['teams', 'high'],
        ['zoom', 'high'],
        ['chrome', 'normal'],
        ['msedge', 'normal'],
        ['code', 'normal'],
        ['inference.service.agent', 'normal'],
        ['onedrive', 'low'],
      ],

      gaming: [
        ['steam', 'critical'],
        ['epic', 'critical'],
        ['discord', 'critical'],
        ['chrome', 'normal'],
        ['onedrive', 'low'],
      ],

      'video-call': [
        ['teams', 'critical'],
        ['zoom', 'critical'],
        ['webex', 'critical'],
        ['chrome', 'high'],
        ['msedge', 'high'],
        ['onedrive', 'low'],
      ],

      streaming: [
        ['chrome', 'high'],
        ['msedge', 'high'],
        ['firefox', 'high'],
        ['spotify', 'high'],
        ['vlc', 'high'],
        ['onedrive', 'low'],
      ],

      development: [
        ['code', 'high'],
        ['node', 'high'],
        ['docker', 'high'],
        ['githubdesktop', 'high'],
        ['inference.service.agent', 'high'],
        ['chrome', 'normal'],
        ['msedge', 'normal'],
        ['onedrive', 'low'],
      ],

      'background-downloads': [
        ['onedrive', 'low'],
        ['dropbox', 'low'],
        ['steam', 'low'],
        ['epic', 'low'],
        ['teams', 'high'],
        ['zoom', 'high'],
      ],
    };

    const profile =
      templates[name] ??
      templates.balanced;

    const detected: any[] = [];

    for (
      const process of
        this.traffic.getLatest()
          .processes ?? []
    ) {
      if (!process.path) {
        continue;
      }

      const haystack =
        `${process.name} ${process.path}`
          .toLowerCase();

      const match =
        profile.find(
          ([term]) =>
            haystack.includes(term),
        );

      if (!match) {
        continue;
      }

      const priority =
        match[1] as
          | 'critical'
          | 'high'
          | 'normal'
          | 'low';

      detected.push({
        processName:
          process.name,
        applicationPath:
          process.path,
        priority,
        throttleMbps:
          priority === 'low'
            ? 5
            : null,
      });
    }

    const unique =
      new Map<string, any>();

    for (const item of detected) {
      unique.set(
        item.applicationPath
          .toLowerCase(),
        item,
      );
    }

    return {
      profile: name,
      detectedApplications:
        [...unique.values()],
      count: unique.size,
    };
  }

  async apply(name: string) {
    const preview =
      await this.preview(name);

    const existing =
      this.qos.getStatus().rules;

    let created = 0;
    let applied = 0;
    let alreadyApplied = 0;

    const failed: any[] = [];

    for (
      const item of
        preview.detectedApplications
    ) {
      try {
        const matchingRule =
          existing.find(
            (rule: any) =>
              rule.applicationPath
                .toLowerCase() ===
              item.applicationPath
                .toLowerCase() &&
              rule.priority ===
                item.priority,
          );

        if (matchingRule) {
          if (
            matchingRule.applied
          ) {
            alreadyApplied += 1;
            continue;
          }

          await this.qos.apply(
            matchingRule.id,
          );

          applied += 1;
          continue;
        }

        const rule: any =
          this.qos.create({
            name:
              `${name} - ${item.processName}`,
            applicationPath:
              item.applicationPath,
            priority:
              item.priority,
            throttleMbps:
              item.throttleMbps,
            enabled: true,
          } as any);

        created += 1;

        await this.qos.apply(
          rule.id,
        );

        applied += 1;
      } catch (error) {
        failed.push({
          applicationPath:
            item.applicationPath,
          message:
            error instanceof Error
              ? error.message
              : String(error),
        });
      }
    }

    return {
      profile: name,
      detected: preview.count,
      created,
      applied,
      alreadyApplied,
      failed,
    };
  }
}
