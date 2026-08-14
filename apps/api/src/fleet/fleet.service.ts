import { Injectable } from '@nestjs/common';
import {
  existsSync,
  readFileSync,
} from 'node:fs';
import { join } from 'node:path';

type AlertStatus =
  | 'open'
  | 'acknowledged'
  | 'resolved'
  | 'closed';

type NormalizedAlert = {
  id: string;
  incidentKey: string;
  deviceId: string;
  type: string;
  severity: string;
  message: string;
  status: AlertStatus;
  resolved: boolean;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class FleetService {
  private readonly cloudSettingsFile =
    join(
      process.cwd(),
      'data',
      'cloud-agent.json',
    );

  private readonly incidentState =
    new Map<
      string,
      {
        status: AlertStatus;
        changedAt: string;
        lastAlertId: string;
      }
    >();

  private getCloudSettings() {
    if (
      !existsSync(
        this.cloudSettingsFile,
      )
    ) {
      throw new Error(
        'Cloud agent settings are not configured.',
      );
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

    if (
      !cloudUrl ||
      !apiKey
    ) {
      throw new Error(
        'Cloud URL or API key is missing.',
      );
    }

    return {
      cloudUrl,
      apiKey,
    };
  }

  private async req(
    path: string,
    init: RequestInit = {},
  ) {
    const {
      cloudUrl,
      apiKey,
    } =
      this.getCloudSettings();

    const response =
      await fetch(
        cloudUrl + path,
        {
          ...init,
          headers: {
            'content-type':
              'application/json',
            'x-nnit-api-key':
              apiKey,
            ...(init.headers ?? {}),
          },
          signal:
            AbortSignal.timeout(
              20000,
            ),
        },
      );

    if (
      !response.ok
    ) {
      throw new Error(
        `Cloud ${response.status}: ${await response.text()}`,
      );
    }

    const text =
      await response.text();

    return text
      ? JSON.parse(text)
      : {};
  }

  summary() {
    return this.req(
      '/api/summary',
    );
  }

  devices() {
    return this.req(
      '/api/devices',
    );
  }

  analytics(
    limit = 500,
  ) {
    const safeLimit =
      Math.max(
        1,
        Math.min(
          2000,
          Number(
            limit || 500,
          ),
        ),
      );

    return this.req(
      `/api/analytics?limit=${safeLimit}`,
    );
  }

  async alerts() {
    const result =
      await this.req(
        '/api/alerts',
      );

    const source =
      Array.isArray(
        result?.alerts,
      )
        ? result.alerts
        : [];

    const rows:
      NormalizedAlert[] =
      source.map(
        (row: any) => {
          const id =
            String(
              row.id ?? '',
            );

          const deviceId =
            String(
              row.deviceId ?? '',
            );

          const type =
            String(
              row.type ??
                'generic',
            );

          const incidentKey =
            `${deviceId}::${type}`;

          const createdAt =
            String(
              row.createdAt ??
                row.updatedAt ??
                new Date().toISOString(),
            );

          const updatedAt =
            String(
              row.updatedAt ??
                row.createdAt ??
                createdAt,
            );

          const cloudResolved =
            Boolean(
              row.resolved,
            ) ||
            row.status ===
              'resolved' ||
            row.status ===
              'closed';

          const local =
            this.incidentState.get(
              incidentKey,
            );

          let status:
            AlertStatus =
              cloudResolved
                ? 'resolved'
                : 'open';

          if (
            local &&
            !cloudResolved
          ) {
            status =
              local.status;
          }

          return {
            id,
            incidentKey,
            deviceId,
            type,
            severity:
              String(
                row.severity ??
                  'warning',
              ),
            message:
              String(
                row.message ??
                  '',
              ),
            status,
            resolved:
              status ===
                'resolved' ||
              status ===
                'closed',
            createdAt,
            updatedAt,
            metadata:
              row.metadata &&
              typeof row.metadata ===
                'object'
                ? row.metadata
                : undefined,
          };
        },
      );

    const newestByIncident =
      new Map<
        string,
        NormalizedAlert
      >();

    for (
      const row of rows
    ) {
      const existing =
        newestByIncident.get(
          row.incidentKey,
        );

      if (
        !existing ||
        new Date(
          row.updatedAt,
        ).getTime() >
          new Date(
            existing.updatedAt,
          ).getTime()
      ) {
        newestByIncident.set(
          row.incidentKey,
          row,
        );
      }
    }

    const incidents =
      [
        ...newestByIncident.values(),
      ].sort(
        (a, b) =>
          new Date(
            b.updatedAt,
          ).getTime() -
          new Date(
            a.updatedAt,
          ).getTime(),
      );

    const active =
      incidents.filter(
        (row) =>
          row.status !==
            'resolved' &&
          row.status !==
            'closed',
      );

    const history =
      incidents.filter(
        (row) =>
          row.status ===
            'resolved' ||
          row.status ===
            'closed',
      );

    return {
      alerts:
        incidents,
      active,
      history,
      activeCount:
        active.length,
      sourceCount:
        rows.length,
      incidentCount:
        incidents.length,
      normalized:
        true,
    };
  }

  async acknowledgeAlert(
    id: string,
    incidentKey?: string,
  ) {
    const key =
      await this.resolveIncidentKey(
        id,
        incidentKey,
      );

    try {
      await this.req(
        `/api/alerts/${id}/acknowledge`,
        {
          method:
            'POST',
        },
      );
    } catch {
      // Legacy Railway API:
      // keep lifecycle state locally.
    }

    this.incidentState.set(
      key,
      {
        status:
          'acknowledged',
        changedAt:
          new Date().toISOString(),
        lastAlertId:
          id,
      },
    );

    return {
      success:
        true,
      source:
        'incident-compatibility',
      incidentKey:
        key,
      status:
        'acknowledged',
      message:
        'Incident acknowledged.',
    };
  }

  async resolveAlert(
    id: string,
    incidentKey?: string,
  ) {
    const key =
      await this.resolveIncidentKey(
        id,
        incidentKey,
      );

    try {
      await this.req(
        `/api/alerts/${id}/resolve`,
        {
          method:
            'POST',
        },
      );
    } catch {
      // Legacy Railway API:
      // keep lifecycle state locally.
    }

    this.incidentState.set(
      key,
      {
        status:
          'resolved',
        changedAt:
          new Date().toISOString(),
        lastAlertId:
          id,
      },
    );

    return {
      success:
        true,
      source:
        'incident-compatibility',
      incidentKey:
        key,
      status:
        'resolved',
      message:
        'Incident resolved locally. It will remain in history while Railway uses the legacy alert API.',
    };
  }

  private async resolveIncidentKey(
    id: string,
    supplied?: string,
  ) {
    if (
      supplied &&
      supplied.includes(
        '::',
      )
    ) {
      return supplied;
    }

    const result =
      await this.req(
        '/api/alerts',
      );

    const rows =
      Array.isArray(
        result?.alerts,
      )
        ? result.alerts
        : [];

    const found =
      rows.find(
        (row: any) =>
          String(
            row.id ?? '',
          ) === id,
      );

    if (!found) {
      throw new Error(
        'Alert not found.',
      );
    }

    return `${String(found.deviceId ?? '')}::${String(found.type ?? 'generic')}`;
  }

  command(
    deviceId: string,
    type: string,
  ) {
    const allowed = [
      'ping-agent',
      'send-telemetry',
      'run-diagnostics',
      'flush-dns',
      'renew-ip',
    ];

    if (
      !allowed.includes(
        type,
      )
    ) {
      throw new Error(
        `Unsupported command: ${type}`,
      );
    }

    return this.req(
      '/api/commands',
      {
        method:
          'POST',
        body:
          JSON.stringify({
            deviceId,
            type,
            payload: {},
          }),
      },
    );
  }
  commandsHistory(deviceId?:string){
    const suffix=deviceId?`?deviceId=${encodeURIComponent(deviceId)}`:'';
    return this.req(`/api/v3/commands/history${suffix}`);
  }

  queueCommand(deviceId:string,type:string){
    const allowed=['ping-agent','send-telemetry','run-diagnostics','flush-dns','renew-ip'];
    if(!allowed.includes(type))throw new Error(`Unsupported command: ${type}`);
    return this.req('/api/v3/commands',{
      method:'POST',
      body:JSON.stringify({deviceId,type,payload:{}}),
    });
  }
  async v3FleetDashboard(){
    const data:any=await this.req('/api/v3/dashboard');
    const fleet=Array.isArray(data?.fleet)?data.fleet:[];
    const devices=fleet.map((d:any)=>({
      id:String(d?.id??''),name:String(d?.name??'unnamed-device'),platform:String(d?.platform??'unknown'),
      agentVersion:String(d?.agentVersion??'3.x'),country:d?.country??null,city:d?.city??null,
      online:Boolean(d?.online),lastSeenAt:d?.lastSeenAt??null,score:d?.score??null,
      latency:d?.latencyMs??d?.latency??null,dns:d?.dnsMs??d?.dns??null,jitter:d?.jitterMs??d?.jitter??null,
      loss:d?.packetLoss??d?.loss??null,cpuPercent:d?.cpuPercent??null,memoryPercent:d?.memoryPercent??null,protocol:'v3'
    }));
    return {...data,devices,total:Number(data?.devices?.total??devices.length),online:Number(data?.devices?.online??devices.filter((d:any)=>d.online).length),offline:Number(data?.devices?.offline??devices.filter((d:any)=>!d.online).length),alerts:Number(data?.incidents?.active??0),critical:Number(data?.incidents?.critical??0),protocol:'v3'};
  }

  async v3FleetDevices(){
    const d:any=await this.v3FleetDashboard();
    return {devices:d.devices??[],total:d.total??0,online:d.online??0,offline:d.offline??0,alerts:d.alerts??0,critical:d.critical??0,protocol:'v3'};
  }
}
