import { EventEmitter } from 'events';
import { redisSet, redisGet } from '../lib/redis';
import { Server as SocketServer } from 'socket.io';

export type SimPhase = 'GATES_OPEN' | 'FILLING' | 'MATCH_LIVE' | 'HALFTIME' | 'CLEARING';
export type DensityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ZoneTrend = 'rising' | 'stable' | 'falling';

export interface ZoneState {
  id: string;
  name: string;
  label: string;
  count: number;
  max: number;
  density: DensityLevel;
  trend: ZoneTrend;
  waitMinutes: number;
  flowRate: number; // fans/min net flow (positive = entering)
  zoneType: string;
  svgPath?: string;
}

export interface GateState {
  id: string;
  name: string;
  queueCount: number;
  waitMinutes: number;
  throughputPerMinute: number;
  status: 'OPEN' | 'CLOSED' | 'LIMITED';
}

export interface SimulationState {
  phase: SimPhase;
  elapsedMinutes: number;
  totalFansInside: number;
  eventId: string;
  zones: ZoneState[];
  gates: GateState[];
  surgeActive: boolean;
  surgeZoneId: string | null;
  lastUpdated: string;
}

interface ZoneConfig {
  id: string;
  name: string;
  label: string;
  max: number;
  zoneType: string;
  svgPath: string;
  baseFlowRate: number; // fans/min during filling
}

interface SurgeEvent {
  zoneId: string;
  extraFlow: number;
  durationSeconds: number;
  triggeredAt: number;
}

const ZONE_CONFIGS: ZoneConfig[] = [
  { id: 'zone-gate-a', name: 'Gate A', label: 'Gate A — South Entry', max: 5000, zoneType: 'ENTRY', svgPath: 'M100,500 L250,500 L250,580 L100,580 Z', baseFlowRate: 180 },
  { id: 'zone-gate-b', name: 'Gate B', label: 'Gate B — North Entry', max: 4500, zoneType: 'ENTRY', svgPath: 'M100,20 L250,20 L250,100 L100,100 Z', baseFlowRate: 160 },
  { id: 'zone-gate-c', name: 'Gate C', label: 'Gate C — East Entry', max: 4500, zoneType: 'ENTRY', svgPath: 'M680,250 L780,250 L780,350 L680,350 Z', baseFlowRate: 160 },
  { id: 'zone-gate-d', name: 'Gate D (VIP)', label: 'Gate D — VIP Entry', max: 1000, zoneType: 'VIP', svgPath: 'M20,250 L120,250 L120,350 L20,350 Z', baseFlowRate: 50 },
  { id: 'zone-north-stand', name: 'North Stand', label: 'North Stand', max: 20000, zoneType: 'STAND', svgPath: 'M250,20 L680,20 L680,250 L250,250 Z', baseFlowRate: 400 },
  { id: 'zone-south-stand', name: 'South Stand', label: 'South Stand', max: 18000, zoneType: 'STAND', svgPath: 'M250,350 L680,350 L680,580 L250,580 Z', baseFlowRate: 360 },
  { id: 'zone-food-court-central', name: 'Food Court Central', label: 'Food Court Central', max: 4000, zoneType: 'FOOD', svgPath: 'M250,250 L450,250 L450,350 L250,350 Z', baseFlowRate: 100 },
  { id: 'zone-food-court-east', name: 'Food Court East', label: 'Food Court East', max: 2500, zoneType: 'FOOD', svgPath: 'M450,250 L680,250 L680,350 L450,350 Z', baseFlowRate: 60 },
];

// Phase definitions: [start_minute, end_minute]
const PHASE_TIMELINE: Record<SimPhase, [number, number]> = {
  GATES_OPEN: [0, 2],
  FILLING: [2, 8],
  MATCH_LIVE: [8, 13],
  HALFTIME: [13, 16],
  CLEARING: [16, 20],
};

function computeDensity(count: number, max: number): DensityLevel {
  const ratio = count / max;
  if (ratio >= 0.95) return 'CRITICAL';
  if (ratio >= 0.80) return 'HIGH';
  if (ratio >= 0.50) return 'MEDIUM';
  return 'LOW';
}

function randBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export class SimulationEngine extends EventEmitter {
  private state: SimulationState;
  private io: SocketServer | null = null;
  private paused = false;
  private tickInterval: NodeJS.Timeout | null = null;
  private broadcastInterval: NodeJS.Timeout | null = null;
  private surgeTimeout: NodeJS.Timeout | null = null;
  private activeSurge: SurgeEvent | null = null;
  private previousCounts: Map<string, number> = new Map();
  private readonly TICK_MS = 5000; // 5 seconds
  private readonly BROADCAST_MS = 5000; // 5 seconds
  private readonly PHASE_DURATION_MS = 120000; // 2 min per phase (10 min total loop)

  constructor(eventId: string) {
    super();
    this.state = this.initState(eventId);
  }

  private initState(eventId: string): SimulationState {
    const zones: ZoneState[] = ZONE_CONFIGS.map(zc => ({
      id: zc.id,
      name: zc.name,
      label: zc.label,
      count: 0,
      max: zc.max,
      density: 'LOW',
      trend: 'stable',
      waitMinutes: 0,
      flowRate: 0,
      zoneType: zc.zoneType,
      svgPath: zc.svgPath,
    }));

    const gates: GateState[] = [
      { id: 'gate-a', name: 'Gate A', queueCount: 0, waitMinutes: 0, throughputPerMinute: 200, status: 'OPEN' },
      { id: 'gate-b', name: 'Gate B', queueCount: 0, waitMinutes: 0, throughputPerMinute: 200, status: 'OPEN' },
      { id: 'gate-c', name: 'Gate C', queueCount: 0, waitMinutes: 0, throughputPerMinute: 200, status: 'OPEN' },
      { id: 'gate-d', name: 'Gate D (VIP)', queueCount: 0, waitMinutes: 0, throughputPerMinute: 80, status: 'OPEN' },
    ];

    return {
      phase: 'GATES_OPEN',
      elapsedMinutes: 0,
      totalFansInside: 0,
      eventId,
      zones,
      gates,
      surgeActive: false,
      surgeZoneId: null,
      lastUpdated: new Date().toISOString(),
    };
  }

  public attach(io: SocketServer): void {
    this.io = io;
  }

  public start(): void {
    console.log('[SimEngine] Starting simulation for event:', this.state.eventId);
    this.paused = false;

    // Main tick: update counts every 5 seconds
    this.tickInterval = setInterval(() => {
      if (!this.paused) {
        this.tick();
      }
    }, this.TICK_MS);

    // Broadcast to Socket.io every 5 seconds
    this.broadcastInterval = setInterval(() => {
      if (!this.paused) {
        this.broadcast();
      }
    }, this.BROADCAST_MS);

    // Schedule random surge events every 2–3 minutes
    this.scheduleSurge();
  }

  public stop(): void {
    if (this.tickInterval) clearInterval(this.tickInterval);
    if (this.broadcastInterval) clearInterval(this.broadcastInterval);
    if (this.surgeTimeout) clearTimeout(this.surgeTimeout);
  }

  public pause(): void {
    this.paused = true;
    console.log('[SimEngine] Paused');
  }

  public resume(): void {
    this.paused = false;
    console.log('[SimEngine] Resumed');
  }

  public reset(): void {
    this.stop();
    this.state = this.initState(this.state.eventId);
    this.activeSurge = null;
    this.previousCounts.clear();
    this.start();
    console.log('[SimEngine] Reset complete');
  }

  public skipToPhase(phase: SimPhase): void {
    this.state.phase = phase;
    const [startMin] = PHASE_TIMELINE[phase];
    this.state.elapsedMinutes = startMin * (this.PHASE_DURATION_MS / 60000);
    this.applyPhaseTargets();
    console.log('[SimEngine] Skipped to phase:', phase);
  }

  public getState(): SimulationState {
    return { ...this.state };
  }

  private tick(): void {
    // Save previous counts for trend calculation
    this.state.zones.forEach(z => this.previousCounts.set(z.id, z.count));

    // Advance elapsed time (5 seconds = 0.5 simulated minutes in 10-min cycle)
    this.state.elapsedMinutes += 0.5;
    if (this.state.elapsedMinutes >= 20) {
      this.state.elapsedMinutes = 0;
      this.state.phase = 'GATES_OPEN';
    }

    // Determine current phase
    this.updatePhase();

    // Update zone counts using Random Walk + Gravity
    this.updateZoneCounts();

    // Update gates
    this.updateGates();

    // Update totals/metadata
    this.state.totalFansInside = this.state.zones
      .filter(z => z.zoneType !== 'ENTRY')
      .reduce((sum, z) => sum + z.count, 0);
    this.state.lastUpdated = new Date().toISOString();

    // Persist to Redis
    this.persistToRedis();

    // Emit events
    this.emit('tick', this.state);
  }

  private updatePhase(): void {
    const elapsed = this.state.elapsedMinutes;
    let newPhase: SimPhase = 'GATES_OPEN';

    for (const [phase, [start, end]] of Object.entries(PHASE_TIMELINE) as [SimPhase, [number, number]][]) {
      if (elapsed >= start && elapsed < end) {
        newPhase = phase;
        break;
      }
    }

    if (newPhase !== this.state.phase) {
      const oldPhase = this.state.phase;
      this.state.phase = newPhase;
      console.log(`[SimEngine] Phase transition: ${oldPhase} → ${newPhase}`);
      this.emit('phase_change', { oldPhase, newPhase });
    }
  }

  private applyPhaseTargets(): void {
    // Immediately snap counts to phase-appropriate levels
    this.state.zones.forEach(zone => {
      const target = this.getPhaseTarget(zone);
      zone.count = Math.round(target * zone.max);
      zone.density = computeDensity(zone.count, zone.max);
    });
  }

  private getPhaseTarget(zone: ZoneState): number {
    // Returns desired fill ratio (0–1) for this zone in current phase
    switch (this.state.phase) {
      case 'GATES_OPEN':
        if (zone.zoneType === 'ENTRY') return 0.1;
        return 0.02;
      case 'FILLING':
        if (zone.zoneType === 'ENTRY') return 0.6;
        if (zone.zoneType === 'STAND') return 0.4;
        if (zone.zoneType === 'FOOD') return 0.3;
        return 0.3;
      case 'MATCH_LIVE':
        if (zone.zoneType === 'ENTRY') return 0.2;
        if (zone.zoneType === 'STAND') return 0.85;
        if (zone.zoneType === 'FOOD') return 0.35;
        return 0.5;
      case 'HALFTIME':
        if (zone.zoneType === 'ENTRY') return 0.15;
        if (zone.zoneType === 'STAND') return 0.4;
        if (zone.zoneType === 'FOOD') return 0.9; // food courts spike!
        return 0.4;
      case 'CLEARING':
        if (zone.zoneType === 'ENTRY') return 0.7; // queued to leave
        if (zone.zoneType === 'STAND') return 0.3;
        if (zone.zoneType === 'FOOD') return 0.2;
        return 0.3;
      default:
        return 0.1;
    }
  }

  private updateZoneCounts(): void {
    this.state.zones.forEach(zone => {
      const prevCount = this.previousCounts.get(zone.id) ?? zone.count;
      const targetRatio = this.getPhaseTarget(zone);
      const targetCount = Math.round(targetRatio * zone.max);

      // Gravity: pull toward target
      const gravity = (targetCount - zone.count) * 0.08; // 8% per tick

      // Random walk: small noise
      const noise = randBetween(-zone.max * 0.005, zone.max * 0.005);

      // Surge bonus
      let surgeBonus = 0;
      if (this.activeSurge && this.activeSurge.zoneId === zone.id) {
        surgeBonus = this.activeSurge.extraFlow * (this.TICK_MS / 60000);
      }

      // Repulsion: strongly push back if > 98% capacity
      const ratio = zone.count / zone.max;
      const repulsion = ratio > 0.98 ? -(zone.count - zone.max * 0.96) * 0.3 : 0;

      // Net flow
      const netFlow = gravity + noise + surgeBonus + repulsion;
      zone.count = clamp(Math.round(zone.count + netFlow), 0, zone.max);
      zone.flowRate = Math.round((zone.count - prevCount) / (this.TICK_MS / 60000));

      // Density
      const newDensity = computeDensity(zone.count, zone.max);

      // Trend
      const delta = zone.count - prevCount;
      if (delta > zone.max * 0.003) zone.trend = 'rising';
      else if (delta < -zone.max * 0.003) zone.trend = 'falling';
      else zone.trend = 'stable';

      zone.density = newDensity;

      // Wait time (food courts / entries)
      if (zone.zoneType === 'FOOD' || zone.zoneType === 'ENTRY') {
        const fillRatio = zone.count / zone.max;
        zone.waitMinutes = Math.round(fillRatio * 15);
      }
    });
  }

  private updateGates(): void {
    const entryZones = this.state.zones.filter(z => z.zoneType === 'ENTRY' || z.zoneType === 'VIP');

    this.state.gates.forEach((gate, idx) => {
      const correspondingZone = entryZones[idx];
      if (!correspondingZone) return;

      const zoneRatio = correspondingZone.count / correspondingZone.max;

      // Queue count correlates with zone fill
      gate.queueCount = Math.round(zoneRatio * correspondingZone.max * 0.6);
      gate.throughputPerMinute = Math.round(200 * (1 - zoneRatio * 0.5));
      gate.waitMinutes = gate.queueCount > 0
        ? Math.round(gate.queueCount / gate.throughputPerMinute)
        : 0;

      // Status
      if (zoneRatio > 0.97) gate.status = 'LIMITED';
      else gate.status = 'OPEN';
    });
  }

  private scheduleSurge(): void {
    const delay = randBetween(120000, 180000); // 2–3 minutes
    this.surgeTimeout = setTimeout(() => {
      this.triggerSurge();
      this.scheduleSurge(); // schedule next
    }, delay);
  }

  public triggerSurge(zoneId?: string): void {
    if (this.paused) return;

    let zone: ZoneState | undefined;
    if (zoneId) {
       zone = this.state.zones.find(z => z.id === zoneId);
    }
    
    if (!zone) {
      // Pick a random entry or food zone
      const candidates = this.state.zones.filter(z =>
        (z.zoneType === 'ENTRY' || z.zoneType === 'FOOD') && z.count / z.max < 0.9
      );
      if (candidates.length === 0) return;
      zone = candidates[randBetween(0, candidates.length - 1)];
    }

    const extraFlow = randBetween(150, 300); // +150 to +300 fans/min surge

    this.activeSurge = {
      zoneId: zone.id,
      extraFlow,
      durationSeconds: randBetween(30, 90),
      triggeredAt: Date.now(),
    };

    this.state.surgeActive = true;
    this.state.surgeZoneId = zone.id;

    console.log(`[SimEngine] Surge event: +${extraFlow} fans/min at ${zone.name}`);
    this.emit('surge', { zoneId: zone.id, extraFlow, zoneName: zone.name });

    // Clear surge after duration
    setTimeout(() => {
      this.activeSurge = null;
      this.state.surgeActive = false;
      this.state.surgeZoneId = null;
    }, this.activeSurge.durationSeconds * 1000);
  }

  private async persistToRedis(): Promise<void> {
    try {
      // Store full state
      await redisSet(
        `event:${this.state.eventId}:state`,
        JSON.stringify(this.state),
        30
      );

      // Store individual zone states
      for (const zone of this.state.zones) {
        await redisSet(
          `zone:${zone.id}:live`,
          JSON.stringify(zone),
          30
        );
      }

      // Store gate states
      for (const gate of this.state.gates) {
        await redisSet(
          `gate:${gate.id}:queue`,
          JSON.stringify(gate),
          15
        );
      }
    } catch (err) {
      // Non-fatal — simulation continues
    }
  }

  private broadcast(): void {
    if (!this.io) return;

    const eventRoom = `event:${this.state.eventId}`;

    // Manager room: full zone data
    const managerPayload = {
      phase: this.state.phase,
      elapsedMinutes: this.state.elapsedMinutes,
      totalFansInside: this.state.totalFansInside,
      surgeActive: this.state.surgeActive,
      surgeZoneId: this.state.surgeZoneId,
      zones: this.state.zones.map(z => ({
        zone_id: z.id,
        name: z.name,
        count: z.count,
        max: z.max,
        density_level: z.density,
        trend: z.trend,
        wait_minutes: z.waitMinutes,
        flow_rate: z.flowRate,
        zone_type: z.zoneType,
        svg_path: z.svgPath,
      })),
      gates: this.state.gates.map(g => ({
        gate_id: g.id,
        name: g.name,
        queue_count: g.queueCount,
        wait_minutes: g.waitMinutes,
        throughput_per_min: g.throughputPerMinute,
        status: g.status,
      })),
    };

    this.io.to(`${eventRoom}:manager`).emit('zone_update', managerPayload);

    // Fan room: zone colors only (no counts, privacy)
    const fanPayload = {
      phase: this.state.phase,
      zones: this.state.zones.map(z => ({
        zone_id: z.id,
        density_level: z.density,
        trend: z.trend,
        wait_minutes: z.waitMinutes,
      })),
      gates: this.state.gates.map(g => ({
        gate_id: g.id,
        wait_minutes: g.waitMinutes,
        status: g.status,
      })),
    };

    this.io.to(`${eventRoom}:fan`).emit('zone_update', fanPayload);
  }
}

// Singleton instance
let engineInstance: SimulationEngine | null = null;

export function getSimulationEngine(eventId?: string): SimulationEngine {
  if (!engineInstance) {
    if (!eventId) throw new Error('eventId required for first initialization');
    engineInstance = new SimulationEngine(eventId);
  }
  return engineInstance;
}

export function resetSimulationEngine(eventId: string): SimulationEngine {
  if (engineInstance) engineInstance.stop();
  engineInstance = new SimulationEngine(eventId);
  return engineInstance;
}
