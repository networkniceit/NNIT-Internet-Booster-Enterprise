import {
  Injectable,
  OnModuleInit,
} from '@nestjs/common';
import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import {
  dirname,
  join,
} from 'node:path';
import { promisify } from 'node:util';
import {
  QosPriority,
  QosRule,
  QosStatus,
} from './qos.types';

const execFileAsync =
  promisify(execFile);

@Injectable()
export class QosService
  implements OnModuleInit
{
  private rules: QosRule[] = [];

  private readonly dataFile =
    join(
      process.cwd(),
      'data',
      'qos-rules.json',
    );

  async onModuleInit() {
    this.loadRules();

    await this.reconcile();

    this.saveRules();
  }

  getStatus(): QosStatus {
    return {
      rules: this.rules,

      appliedCount:
        this.rules.filter(
          (rule) => rule.applied,
        ).length,

      enabledCount:
        this.rules.filter(
          (rule) => rule.enabled,
        ).length,

      administratorRequired: true,

      timestamp:
        new Date().toISOString(),
    };
  }

  create(
    input: Partial<QosRule>,
  ): QosRule {
    const applicationPath =
      String(
        input.applicationPath ?? '',
      ).trim();

    if (!applicationPath) {
      throw new Error(
        'Application path is required.',
      );
    }

    const priority =
      (input.priority ??
        'normal') as QosPriority;

    const existing =
      this.rules.find(
        (rule) =>
          rule.applicationPath
            .toLowerCase() ===
            applicationPath.toLowerCase() &&
          rule.priority === priority,
      );

    if (existing) {
      return existing;
    }

    const now =
      new Date().toISOString();

    const rule: QosRule = {
      id: crypto.randomUUID(),

      name:
        String(
          input.name ??
            'Application QoS',
        ),

      applicationPath,

      priority,

      dscpValue:
        input.dscpValue ??
        this.defaultDscp(
          priority,
        ),

      throttleMbps:
        input.throttleMbps ??
        null,

      enabled:
        input.enabled ?? true,

      applied: false,

      lastMessage:
        'Rule created.',

      createdAt: now,
      updatedAt: now,
    };

    this.rules.push(rule);

    this.saveRules();

    return rule;
  }

  async apply(
    id: string,
  ): Promise<QosRule> {
    const rule =
      this.requireRule(id);

    const policyName =
      this.policyName(rule);

    const safeName =
      policyName.replaceAll(
        "'",
        "''",
      );

    const safePath =
      rule.applicationPath.replaceAll(
        "'",
        "''",
      );

    const commands = [
      "$ErrorActionPreference='Stop'",

      `Get-NetQosPolicy -Name '${safeName}' -ErrorAction SilentlyContinue | Remove-NetQosPolicy -Confirm:$false -ErrorAction SilentlyContinue`,

      `$params=@{Name='${safeName}';AppPathNameMatchCondition='${safePath}';NetworkProfile='All';DSCPAction=${rule.dscpValue}}`,
    ];

    if (
      rule.throttleMbps !== null
    ) {
      const bits =
        Math.round(
          rule.throttleMbps *
            1_000_000,
        );

      commands.push(
        `$params['ThrottleRateActionBitsPerSecond']=${bits}`,
      );
    }

    commands.push(
      'New-NetQosPolicy @params | Out-Null',
    );

    await execFileAsync(
      'powershell.exe',
      [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        commands.join(
          String.fromCharCode(
            10,
          ),
        ),
      ],
      {
        timeout: 20000,
        windowsHide: true,
      },
    );

    rule.applied = true;

    rule.lastMessage =
      'Windows QoS policy applied.';

    rule.updatedAt =
      new Date().toISOString();

    this.saveRules();

    return rule;
  }

  async remove(
    id: string,
  ): Promise<QosRule> {
    const rule =
      this.requireRule(id);

    const safeName =
      this.policyName(
        rule,
      ).replaceAll(
        "'",
        "''",
      );

    await execFileAsync(
      'powershell.exe',
      [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        `Get-NetQosPolicy -Name '${safeName}' -ErrorAction SilentlyContinue | Remove-NetQosPolicy -Confirm:$false`,
      ],
      {
        timeout: 15000,
        windowsHide: true,
      },
    );

    rule.applied = false;

    rule.lastMessage =
      'Windows QoS policy removed.';

    rule.updatedAt =
      new Date().toISOString();

    this.saveRules();

    return rule;
  }

  async delete(
    id: string,
  ): Promise<unknown> {
    const rule =
      this.requireRule(id);

    if (rule.applied) {
      await this.remove(id);
    }

    this.rules =
      this.rules.filter(
        (item) =>
          item.id !== id,
      );

    this.saveRules();

    return {
      success: true,
    };
  }

  async reconcile(): Promise<QosStatus> {
    const script = [
      "$ErrorActionPreference='SilentlyContinue'",
      "$result=@(Get-NetQosPolicy | Where-Object {$_.Name -like 'NNIT-QOS-*'} | ForEach-Object {",
      " $app=$_.AppPathName",
      " if(-not $app){$app=$_.AppPathNameMatchCondition}",
      " [pscustomobject]@{",
      "  name=$_.Name",
      "  applicationPath=[string]$app",
      "  dscpValue=[int]$_.DSCPValue",
      "  throttleBits=$_.ThrottleRate",
      " }",
      "})",
      "@($result)|ConvertTo-Json -Compress -Depth 5",
    ].join(
      String.fromCharCode(
        10,
      ),
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
            timeout: 20000,
            windowsHide: true,
          },
        );

      const parsed =
        output.stdout.trim()
          ? JSON.parse(
              output.stdout.trim(),
            )
          : [];

      const policies =
        Array.isArray(parsed)
          ? parsed
          : [parsed];

      const foundIds =
        new Set<string>();

      for (
        const policy of policies
      ) {
        const id =
          String(
            policy.name,
          ).replace(
            /^NNIT-QOS-/i,
            '',
          );

        foundIds.add(id);

        const existing =
          this.rules.find(
            (rule) =>
              rule.id === id,
          );

        if (existing) {
          existing.applied =
            true;

          existing.lastMessage =
            'Windows QoS policy synchronized.';

          continue;
        }

        const dscpValue =
          Number(
            policy.dscpValue ??
              0,
          );

        const priority =
          this.priorityFromDscp(
            dscpValue,
          );

        const path =
          String(
            policy.applicationPath ??
              '',
          );

        const now =
          new Date().toISOString();

        this.rules.push({
          id,

          name:
            `Recovered - ${
              path
                .replaceAll(
                  '\\',
                  '/',
                )
                .split('/')
                .pop() ??
              'Application'
            }`,

          applicationPath:
            path,

          priority,

          dscpValue,

          throttleMbps:
            policy.throttleBits
              ? Number(
                  (
                    Number(
                      policy.throttleBits,
                    ) /
                    1_000_000
                  ).toFixed(
                    2,
                  ),
                )
              : null,

          enabled: true,
          applied: true,

          lastMessage:
            'Recovered from Windows QoS.',

          createdAt: now,
          updatedAt: now,
        });
      }

      for (
        const rule of this.rules
      ) {
        if (
          !foundIds.has(
            rule.id,
          )
        ) {
          rule.applied =
            false;
        }
      }

      this.removeDuplicateDrafts();

      this.saveRules();
    } catch (error) {
      console.warn(
        'QoS reconciliation failed:',
        error,
      );
    }

    return this.getStatus();
  }

  private removeDuplicateDrafts() {
    const applied =
      new Set(
        this.rules
          .filter(
            (rule) =>
              rule.applied,
          )
          .map(
            (rule) =>
              `${rule.applicationPath.toLowerCase()}|${rule.priority}`,
          ),
      );

    const seen =
      new Set<string>();

    this.rules =
      this.rules.filter(
        (rule) => {
          const key =
            `${rule.applicationPath.toLowerCase()}|${rule.priority}`;

          if (rule.applied) {
            seen.add(key);
            return true;
          }

          if (
            applied.has(key) ||
            seen.has(key)
          ) {
            return false;
          }

          seen.add(key);

          return true;
        },
      );
  }

  private requireRule(
    id: string,
  ) {
    const rule =
      this.rules.find(
        (item) =>
          item.id === id,
      );

    if (!rule) {
      throw new Error(
        'QoS rule not found.',
      );
    }

    return rule;
  }

  private policyName(
    rule: QosRule,
  ) {
    return `NNIT-QOS-${rule.id}`;
  }

  private loadRules() {
    try {
      if (
        existsSync(
          this.dataFile,
        )
      ) {
        this.rules =
          JSON.parse(
            readFileSync(
              this.dataFile,
              'utf8',
            ),
          );
      }
    } catch {
      this.rules = [];
    }
  }

  private saveRules() {
    mkdirSync(
      dirname(
        this.dataFile,
      ),
      {
        recursive: true,
      },
    );

    writeFileSync(
      this.dataFile,
      JSON.stringify(
        this.rules,
        null,
        2,
      ),
      'utf8',
    );
  }

  private defaultDscp(
    priority: QosPriority,
  ) {
    return {
      critical: 46,
      high: 34,
      normal: 0,
      low: 8,
    }[priority];
  }

  private priorityFromDscp(
    value: number,
  ): QosPriority {
    if (value >= 46) {
      return 'critical';
    }

    if (value >= 34) {
      return 'high';
    }

    if (
      value > 0 &&
      value <= 8
    ) {
      return 'low';
    }

    return 'normal';
  }
}
