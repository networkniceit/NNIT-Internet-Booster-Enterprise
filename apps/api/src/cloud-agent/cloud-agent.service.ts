import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';

type CloudSettings = {
  enabled: boolean;
  cloudUrl: string;
  apiKey: string;
  deviceId: string;
  deviceName: string;
  heartbeatSeconds: number;
  telemetrySeconds: number;
  organizationId?: string;
  country?: string;
  city?: string;
  useV3?: boolean;
};

@Injectable()
export class CloudAgentService implements OnModuleInit, OnModuleDestroy {
  private readonly dataDir = join(process.cwd(), 'data');
  private readonly settingsFile = join(this.dataDir, 'cloud-agent.json');

  private heartbeatTimer: NodeJS.Timeout | null = null;
  private telemetryTimer: NodeJS.Timeout | null = null;
  private commandTimer: NodeJS.Timeout | null = null;

  private state = {
    cloudReachable: false,
    lastHeartbeatAt: null as string | null,
    lastTelemetryAt: null as string | null,
    lastCommandPollAt: null as string | null,
    lastError: null as string | null,
    enabled: false,
    registered: false,
    cloudUrl: '',
    deviceId: '',
    deviceName: os.hostname(),
    protocol: 'v3',
  };

  onModuleInit() {
    this.ensureDataDir();
    this.syncState();
    this.restartTimers();
  }

  onModuleDestroy() {
    this.clearTimers();
  }

  private defaults(): CloudSettings {
    return {
      enabled: false,
      cloudUrl:
        'https://nnit-internet-booster-enterprise-production.up.railway.app',
      apiKey: '',
      deviceId: '',
      deviceName: os.hostname(),
      heartbeatSeconds: 30,
      telemetrySeconds: 30,
      country: '',
      city: '',
      useV3: true,
    };
  }

  private ensureDataDir() {
    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true });
    }
  }

  private readSettings(): CloudSettings {
    this.ensureDataDir();

    if (!existsSync(this.settingsFile)) {
      const defaults = this.defaults();

      writeFileSync(
        this.settingsFile,
        JSON.stringify(defaults, null, 2),
        'utf8',
      );

      return defaults;
    }

    return {
      ...this.defaults(),
      ...JSON.parse(
        readFileSync(
          this.settingsFile,
          'utf8',
        ),
      ),
    };
  }

  private writeSettings(settings: CloudSettings) {
    this.ensureDataDir();

    writeFileSync(
      this.settingsFile,
      JSON.stringify(settings, null, 2),
      'utf8',
    );

    this.syncState();
  }

  private syncState() {
    const settings = this.readSettings();

    this.state.enabled = Boolean(settings.enabled);
    this.state.cloudUrl = String(settings.cloudUrl ?? '');
    this.state.deviceId = String(settings.deviceId ?? '');
    this.state.deviceName =
      String(settings.deviceName ?? os.hostname());
    this.state.registered =
      Boolean(settings.deviceId);
    this.state.protocol =
      settings.useV3 === false ? 'v2' : 'v3';
  }

  // Existing controller compatibility.
  getStatus() {
    return {
      ...this.state,
    };
  }

  getSettings() {
    const settings = this.readSettings();

    return {
      ...settings,
      apiKey:
        settings.apiKey
          ? '********'
          : '',
    };
  }

  async updateSettings(
    body: Partial<CloudSettings>,
  ) {
    const current = this.readSettings();

    const next: CloudSettings = {
      ...current,
      ...body,
      cloudUrl:
        String(
          body.cloudUrl ??
          current.cloudUrl,
        ).replace(/\/+$/, ''),
      deviceName:
        String(
          body.deviceName ??
          current.deviceName ??
          os.hostname(),
        ),
      apiKey:
        body.apiKey === '********'
          ? current.apiKey
          : String(
              body.apiKey ??
              current.apiKey,
            ),
      heartbeatSeconds:
        Math.max(
          10,
          Number(
            body.heartbeatSeconds ??
            current.heartbeatSeconds,
          ),
        ),
      telemetrySeconds:
        Math.max(
          10,
          Number(
            body.telemetrySeconds ??
            current.telemetrySeconds,
          ),
        ),
      useV3:
        body.useV3 === undefined
          ? current.useV3 !== false
          : Boolean(body.useV3),
    };

    this.writeSettings(next);
    this.restartTimers();

    return this.getSettings();
  }

  async register() {
    const settings = this.readSettings();

    if (!settings.cloudUrl || !settings.apiKey) {
      throw new Error(
        'Cloud URL or API key is missing.',
      );
    }

    if (settings.useV3 !== false) {
      try {
        const result =
          await this.request(
            settings,
            '/api/v3/devices/register',
            {
              method: 'POST',
              body:
                JSON.stringify({
                  deviceId: settings.deviceId || undefined,
                  id: settings.deviceId || undefined,
                  organizationId:
                    settings.organizationId ||
                    undefined,
                  name:
                    settings.deviceName ||
                    os.hostname(),
                  platform:
                    process.platform,
                  agentVersion:
                    '3.0.0-phase2',
                  country:
                    settings.country ||
                    undefined,
                  city:
                    settings.city ||
                    undefined,
                  metadata: {
                    hostname:
                      os.hostname(),
                    arch:
                      os.arch(),
                    release:
                      os.release(),
                    cpus:
                      os.cpus().length,
                    totalMemoryBytes:
                      os.totalmem(),
                  },
                }),
            },
          );

        const returnedDeviceId = String(result?.device?.id ?? result?.id ?? '');

        const deviceId = settings.deviceId || returnedDeviceId;

        if (!deviceId) {
          throw new Error(
            'v3 registration returned no device ID.',
          );
        }

        this.writeSettings({
          ...settings,
          deviceId,
          useV3: true,
        });

        this.state.registered = true;
        this.state.cloudReachable = true;
        this.state.lastError = null;
        this.state.protocol = 'v3';

        return {
          ...result,
          protocol: 'v3',
        };
      } catch (error) {
        this.state.lastError =
          error instanceof Error
            ? error.message
            : String(error);
      }
    }

    const result =
      await this.request(
        settings,
        '/api/devices/register',
        {
          method: 'POST',
          body:
            JSON.stringify({
              id:
                settings.deviceId ||
                undefined,
              name:
                settings.deviceName ||
                os.hostname(),
              platform:
                'windows',
              agentVersion:
                '3.0.0-phase2',
              metadata: {
                hostname:
                  os.hostname(),
              },
            }),
        },
      );

    const deviceId =
      String(
        result?.device?.id ??
        result?.id ??
        settings.deviceId ??
        '',
      );

    if (deviceId) {
      this.writeSettings({
        ...settings,
        deviceId,
      });

      this.state.registered = true;
    }

    this.state.cloudReachable = true;
    this.state.protocol = 'v2';

    return {
      ...result,
      protocol: 'v2',
      fallback: true,
    };
  }

  async heartbeat() {
    return this.sendHeartbeat();
  }

  async telemetry() {
    return this.sendTelemetry();
  }

  async start() {
    const settings = this.readSettings();

    if (!settings.enabled) {
      this.writeSettings({
        ...settings,
        enabled: true,
      });
    }

    this.restartTimers();

    if (!this.readSettings().deviceId) {
      await this.register();
    }

    const heartbeatResult =
      await this.sendHeartbeat();

    const telemetryResult =
      await this.sendTelemetry();

    return {
      success: true,
      status:
        this.getStatus(),
      heartbeat:
        heartbeatResult,
      telemetry:
        telemetryResult,
    };
  }

  async sendHeartbeat() {
    const settings = this.readSettings();

    if (!settings.enabled || !settings.deviceId) {
      return {
        success: false,
        skipped: true,
        reason:
          'Cloud agent is disabled or not registered.',
      };
    }

    const primaryPath =
      settings.useV3 === false
        ? `/api/devices/${settings.deviceId}/heartbeat`
        : `/api/v3/devices/${settings.deviceId}/heartbeat`;

    try {
      await this.request(
        settings,
        primaryPath,
        {
          method: 'POST',
          body: '{}',
        },
      );

      const now =
        new Date().toISOString();

      this.state.lastHeartbeatAt = now;
      this.state.cloudReachable = true;
      this.state.lastError = null;
      this.state.protocol =
        settings.useV3 === false
          ? 'v2'
          : 'v3';

      return {
        success: true,
        timestamp: now,
        protocol:
          this.state.protocol,
      };
    } catch (error) {
      if (settings.useV3 !== false) {
        try {
          await this.request(
            settings,
            `/api/devices/${settings.deviceId}/heartbeat`,
            {
              method: 'POST',
              body: '{}',
            },
          );

          const now =
            new Date().toISOString();

          this.state.lastHeartbeatAt = now;
          this.state.cloudReachable = true;
          this.state.lastError = null;
          this.state.protocol = 'v2';

          return {
            success: true,
            timestamp: now,
            protocol: 'v2',
            fallback: true,
          };
        } catch {
          // Shared failure below.
        }
      }

      return this.fail(error);
    }
  }

  async sendTelemetry() {
    const settings = this.readSettings();

    if (!settings.enabled || !settings.deviceId) {
      return {
        success: false,
        skipped: true,
        reason:
          'Cloud agent is disabled or not registered.',
      };
    }    const total = os.totalmem();
    const free = os.freemem();

    let measurement:any = {};
    let traffic:any = {};
    let pressure:any = {};
    let diagnostics:any = {};

    try {
      const r = await fetch(
        'http://localhost:4000/api/measurement/live',
        { signal: AbortSignal.timeout(5000) },
      );
      if (r.ok) measurement = await r.json();
    } catch {}

    try {
      const r = await fetch(
        'http://localhost:4000/api/traffic/live',
        { signal: AbortSignal.timeout(5000) },
      );
      if (r.ok) traffic = await r.json();
    } catch {}

    try {
      const r = await fetch(
        'http://localhost:4000/api/resource-pressure/status',
        { signal: AbortSignal.timeout(5000) },
      );
      if (r.ok) pressure = await r.json();
    } catch {}

    try {
      const r = await fetch(
        'http://localhost:4000/api/remote-diagnostics/telemetry',
        { signal: AbortSignal.timeout(8000) },
      );
      if (r.ok) diagnostics = await r.json();
    } catch {}

    const payload = {
      score:
        measurement.unifiedScore ??
        measurement.score ??
        null,

      latencyMs:
        measurement.internetTcpLatency ??
        measurement.latency ??
        null,

      dnsMs:
        measurement.dnsLatency ??
        measurement.dns ??
        null,

      jitterMs:
        measurement.relayUdpJitter ??
        measurement.jitter ??
        null,

      packetLoss:
        measurement.relayPacketLoss ??
        measurement.packetLoss ??
        0,

      cpuPercent:
        pressure.cpuPercent ??
        pressure.cpu ??
        diagnostics.cpuPercent ??
        diagnostics.cpu ??
        null,

      memoryPercent:
        pressure.memoryPercent ??
        pressure.memory ??
        diagnostics.memoryPercent ??
        diagnostics.memory ??
        (
          total > 0
            ? Number((((total - free) / total) * 100).toFixed(1))
            : null
        ),

      freeMemoryGb:
        pressure.freeMemoryGb ??
        diagnostics.freeMemoryGb ??
        Number((free / 1024 / 1024 / 1024).toFixed(2)),

      diskFreeGb:
        diagnostics.diskFreeGb ??
        diagnostics.diskFree ??
        null,

      downloadMbps:
        traffic.downloadMbps ??
        null,

      uploadMbps:
        traffic.uploadMbps ??
        null,

      hostname: os.hostname(),
      deviceName: settings.deviceName || os.hostname(),
      platform: process.platform,
      timestamp: new Date().toISOString(),
    };

    const primaryPath =
      settings.useV3 === false
        ? `/api/devices/${settings.deviceId}/telemetry`
        : `/api/v3/devices/${settings.deviceId}/telemetry`;

    try {
      await this.request(
        settings,
        primaryPath,
        {
          method: 'POST',
          body:
            JSON.stringify(payload),
        },
      );

      const now =
        new Date().toISOString();

      this.state.lastTelemetryAt = now;
      this.state.cloudReachable = true;
      this.state.lastError = null;
      this.state.protocol =
        settings.useV3 === false
          ? 'v2'
          : 'v3';

      return {
        success: true,
        timestamp: now,
        protocol:
          this.state.protocol,
      };
    } catch (error) {
      if (settings.useV3 !== false) {
        try {
          await this.request(
            settings,
            `/api/devices/${settings.deviceId}/telemetry`,
            {
              method: 'POST',
              body:
                JSON.stringify(payload),
            },
          );

          const now =
            new Date().toISOString();

          this.state.lastTelemetryAt = now;
          this.state.cloudReachable = true;
          this.state.lastError = null;
          this.state.protocol = 'v2';

          return {
            success: true,
            timestamp: now,
            protocol: 'v2',
            fallback: true,
          };
        } catch {
          // Shared failure below.
        }
      }

      return this.fail(error);
    }
  }
  async poll() {
    const settings=this.readSettings();

    if(!settings.enabled||!settings.deviceId){
      return {commands:[],skipped:true};
    }

    try{
      if(settings.useV3!==false){
        const result=await this.request(
          settings,
          `/api/v3/devices/${encodeURIComponent(settings.deviceId)}/commands`,
        );

        const commands=Array.isArray(result?.commands)?result.commands:[];
        const executed:any[]=[];

        for(const command of commands){
          const outcome=await this.executeApprovedCommand(command);
          await this.reportCommandResult(settings,String(command?.id??''),outcome);
          executed.push({
            id:command?.id,
            type:command?.type,
            success:Boolean(outcome?.success),
            error:outcome?.error??null,
          });
        }

        this.state.lastCommandPollAt=new Date().toISOString();
        this.state.cloudReachable=true;
        this.state.lastError=null;
        this.state.protocol='v3';

        return {commands,executed,protocol:'v3'};
      }

      const result=await this.request(
        settings,
        `/api/commands?deviceId=${encodeURIComponent(settings.deviceId)}`,
      );

      this.state.lastCommandPollAt=new Date().toISOString();
      this.state.cloudReachable=true;
      this.state.lastError=null;
      this.state.protocol='v2';

      return {...result,protocol:'v2'};
    }catch(error){
      const message=error instanceof Error?error.message:String(error);
      this.state.lastError=message;
      return {commands:[],success:false,error:message,protocol:this.state.protocol};
    }
  }
  private async executeApprovedCommand(command:any){
    const type=String(command?.type??'');

    if(type==='ping-agent'){
      return {success:true,result:{pong:true,hostname:os.hostname(),timestamp:new Date().toISOString()}};
    }

    if(type==='send-telemetry'){
      const result=await this.sendTelemetry();
      return {success:Boolean((result as any)?.success),result};
    }

    if(type==='run-diagnostics'){
      try{
        const r=await fetch('http://localhost:4000/api/remote-diagnostics/telemetry',{signal:AbortSignal.timeout(15000)});
        const t=await r.text();
        return r.ok?{success:true,result:t?JSON.parse(t):{}}:{success:false,error:`Diagnostics ${r.status}: ${t}`};
      }catch(e){
        return {success:false,error:e instanceof Error?e.message:String(e)};
      }
    }

    if(type==='flush-dns'||type==='renew-ip'){
      const endpoint=type==='flush-dns'?'flush-dns':'renew-ip';
      try{
        const r=await fetch(`http://localhost:4000/api/remote-actions/${endpoint}`,{
          method:'POST',
          headers:{'content-type':'application/json'},
          body:'{}',
          signal:AbortSignal.timeout(20000),
        });
        const t=await r.text();
        return r.ok?{success:true,result:t?JSON.parse(t):{}}:{success:false,error:`${type} ${r.status}: ${t}`};
      }catch(e){
        return {success:false,error:e instanceof Error?e.message:String(e)};
      }
    }

    return {success:false,error:`Unsupported command: ${type}`};
  }

  private async reportCommandResult(settings:CloudSettings,commandId:string,outcome:any){
    try{
      await this.request(settings,`/api/v3/commands/${encodeURIComponent(commandId)}/result`,{
        method:'POST',
        body:JSON.stringify({
          success:Boolean(outcome?.success),
          result:outcome?.result??{},
          error:outcome?.success?null:String(outcome?.error??'Command failed'),
        }),
      });
    }catch{}
  }
  private async request(
    settings: CloudSettings,
    path: string,
    init: RequestInit = {},
  ) {
    const response =
      await fetch(
        `${settings.cloudUrl.replace(/\/+$/, '')}${path}`,
        {
          ...init,
          headers: {
            'content-type':
              'application/json',
            'x-nnit-api-key':
              settings.apiKey,
            ...(init.headers ?? {}),
          },
          signal:
            AbortSignal.timeout(
              15000,
            ),
        },
      );

    if (!response.ok) {
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

  private fail(
    error: unknown,
  ) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    this.state.cloudReachable = false;
    this.state.lastError = message;

    return {
      success: false,
      error:
        message,
    };
  }

  private clearTimers() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    if (this.telemetryTimer) {
      clearInterval(this.telemetryTimer);
    }

    if (this.commandTimer) {
      clearInterval(this.commandTimer);
    }

    this.heartbeatTimer = null;
    this.telemetryTimer = null;
    this.commandTimer = null;
  }

  private restartTimers() {
    this.clearTimers();

    const settings = this.readSettings();

    if (!settings.enabled) {
      return;
    }

    this.heartbeatTimer =
      setInterval(
        () =>
          void this.sendHeartbeat(),
        Math.max(
          10000,
          settings.heartbeatSeconds *
            1000,
        ),
      );

    this.telemetryTimer =
      setInterval(
        () =>
          void this.sendTelemetry(),
        Math.max(
          10000,
          settings.telemetrySeconds *
            1000,
        ),
      );

    this.commandTimer =
      setInterval(
        () =>
          void this.poll(),
        15000,
      );

    this.heartbeatTimer.unref();
    this.telemetryTimer.unref();
    this.commandTimer.unref();
  }
}




