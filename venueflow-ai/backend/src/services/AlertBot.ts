import { redisGet, redisExists, redisSet } from '../lib/redis';
import { prisma } from '../lib/prisma';
import { Server as SocketServer } from 'socket.io';

interface ZoneSnapshot {
  id: string;
  name: string;
  count: number;
  max: number;
  density: string;
  waitMinutes: number;
  zoneType: string;
}

interface GateSnapshot {
  id: string;
  name: string;
  waitMinutes: number;
  status: string;
}

interface AlertRule {
  check: (zone: ZoneSnapshot | GateSnapshot) => boolean;
  severity: 'WARNING' | 'CRITICAL';
  getMessage: (z: ZoneSnapshot | GateSnapshot) => string;
}

const DEDUP_TTL = 600; // 10 minutes

export class AlertBot {
  private io: SocketServer | null = null;
  private interval: NodeJS.Timeout | null = null;
  private eventId: string;
  private readonly INTERVAL_MS = 60000; // 60 seconds

  constructor(eventId: string) {
    this.eventId = eventId;
  }

  public attach(io: SocketServer): void {
    this.io = io;
  }

  public start(): void {
    console.log('[AlertBot] Starting for event:', this.eventId);
    this.interval = setInterval(() => this.run(), this.INTERVAL_MS);
    // Run once immediately
    setTimeout(() => this.run(), 5000);
  }

  public stop(): void {
    if (this.interval) clearInterval(this.interval);
  }

  private async run(): Promise<void> {
    try {
      const zones = await this.readZonesFromRedis();
      const gates = await this.readGatesFromRedis();

      for (const zone of zones) {
        await this.evaluateZone(zone);
      }

      for (const gate of gates) {
        await this.evaluateGate(gate);
      }
    } catch (err) {
      console.error('[AlertBot] Error during run:', err);
    }
  }

  private async readZonesFromRedis(): Promise<ZoneSnapshot[]> {
    const zoneIds = [
      'zone-gate-a', 'zone-gate-b', 'zone-gate-c', 'zone-gate-d',
      'zone-north-stand', 'zone-south-stand',
      'zone-food-court-central', 'zone-food-court-east',
    ];

    const zones: ZoneSnapshot[] = [];
    for (const id of zoneIds) {
      const data = await redisGet(`zone:${id}:live`);
      if (data) {
        try {
          const parsed = JSON.parse(data);
          zones.push({
            id: parsed.id,
            name: parsed.name,
            count: parsed.count,
            max: parsed.max,
            density: parsed.density,
            waitMinutes: parsed.waitMinutes,
            zoneType: parsed.zoneType,
          });
        } catch { /* skip malformed */ }
      }
    }
    return zones;
  }

  private async readGatesFromRedis(): Promise<GateSnapshot[]> {
    const gateIds = ['gate-a', 'gate-b', 'gate-c', 'gate-d'];
    const gates: GateSnapshot[] = [];
    for (const id of gateIds) {
      const data = await redisGet(`gate:${id}:queue`);
      if (data) {
        try {
          const parsed = JSON.parse(data);
          gates.push({
            id: parsed.id,
            name: parsed.name,
            waitMinutes: parsed.waitMinutes,
            status: parsed.status,
          });
        } catch { /* skip */ }
      }
    }
    return gates;
  }

  private async evaluateZone(zone: ZoneSnapshot): Promise<void> {
    const ratio = zone.count / zone.max;

    let severity: 'WARNING' | 'CRITICAL' | null = null;
    let message = '';

    if (ratio > 0.98) {
      severity = 'CRITICAL';
      message = `CRITICAL: ${zone.name} is at ${Math.round(ratio * 100)}% capacity (${zone.count.toLocaleString('en-IN')}/${zone.max.toLocaleString('en-IN')} fans). Immediate crowd management required.`;
    } else if (ratio > 0.90) {
      severity = 'WARNING';
      message = `WARNING: ${zone.name} approaching capacity — ${Math.round(ratio * 100)}% filled. Consider redirecting fans.`;
    } else if (zone.zoneType === 'FOOD' && ratio > 0.95) {
      severity = 'WARNING';
      message = `Food court ${zone.name} is severely congested (${Math.round(ratio * 100)}%). Long wait times expected.`;
    }

    if (severity) {
      await this.createAlert(zone.id, zone.name, severity, message);
    }
  }

  private async evaluateGate(gate: GateSnapshot): Promise<void> {
    let severity: 'WARNING' | 'CRITICAL' | null = null;
    let message = '';

    if (gate.waitMinutes > 20) {
      severity = 'CRITICAL';
      message = `CRITICAL: ${gate.name} queue wait is ${gate.waitMinutes} minutes. Gate overwhelmed — open additional entry lanes immediately.`;
    } else if (gate.waitMinutes > 12) {
      severity = 'WARNING';
      message = `WARNING: ${gate.name} queue wait exceeds 12 minutes (${gate.waitMinutes} min). Consider diverting fans to Gate B.`;
    }

    if (severity) {
      await this.createAlert(gate.id, gate.name, severity, message);
    }
  }

  private async createAlert(
    zoneId: string,
    zoneName: string,
    severity: 'WARNING' | 'CRITICAL',
    message: string
  ): Promise<void> {
    // Dedup check
    const dedupKey = `alert:dedup:${zoneId}:${severity}`;
    const exists = await redisExists(dedupKey);
    if (exists) return; // Already alerted recently

    try {
      // Try to persist to DB
      const event = await prisma.event.findFirst({
        where: { id: this.eventId },
        select: { id: true },
      }).catch(() => null);

      let alertId = `alert-${Date.now()}`;

      if (event) {
        const alert = await prisma.alert.create({
          data: {
            eventId: this.eventId,
            zoneId: zoneId.startsWith('zone-') ? zoneId : undefined,
            zoneName,
            severity,
            message,
            aiGenerated: false,
          },
        });
        alertId = alert.id;
      }

      // Set dedup key in Redis
      await redisSet(dedupKey, '1', DEDUP_TTL);

      // Emit to manager room
      if (this.io) {
        this.io.to(`event:${this.eventId}:manager`).emit('new_alert', {
          alert_id: alertId,
          severity,
          zone_id: zoneId,
          zone_name: zoneName,
          message,
          ai_generated: false,
          created_at: new Date().toISOString(),
        });
      }

      console.log(`[AlertBot] Created ${severity} alert for ${zoneName}`);
    } catch (err) {
      console.error('[AlertBot] Failed to create alert:', err);
    }
  }

  // Public method to create a surge-triggered alert
  public async createSurgeAlert(zoneId: string, zoneName: string, extraFlow: number): Promise<void> {
    const message = `SURGE DETECTED: ${zoneName} is experiencing a sudden influx of ~${extraFlow} fans/min. Monitor crowd density closely.`;
    await this.createAlert(zoneId, zoneName, 'WARNING', message);
  }
}

let alertBotInstance: AlertBot | null = null;

export function getAlertBot(eventId?: string): AlertBot {
  if (!alertBotInstance) {
    if (!eventId) throw new Error('eventId required for first initialization');
    alertBotInstance = new AlertBot(eventId);
  }
  return alertBotInstance;
}
