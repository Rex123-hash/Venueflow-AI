import { Router, Request, Response } from 'express';
import {
  generatePredictions,
  generateZoneIntelligence,
  generatePAnnouncement,
  logOperationalEvent,
  logPredictionEvent,
  getFallbackPredictions,
  PredictZone,
  PROJECT_ID,
  MODEL_ID,
  LOCATION,
} from '../services/googleServices';
import { streamFlowBot, buildFlowBotSystemPrompt, runFlowAgent } from '../services/gemini';
import { redisGet } from '../lib/redis';
import { prisma } from '../lib/prisma';
import { getSimulationEngine } from '../services/SimulationEngine';
import { MOCK_TICKET, SEED_EVENT_ID, MOCK_ALERTS } from '../config/mockData';

const router = Router();

// GET /api/ai/chat/stream — SSE FlowBot
router.get('/chat/stream', async (req: Request, res: Response): Promise<void> => {
  const { message, fan_id } = req.query as { message: string; fan_id: string };

  if (!message) {
    res.status(400).json({ error: 'message required' });
    return;
  }

  // Gather fan context
  let fanContext = {
    eventName: 'IPL 2025 — MI vs CSK',
    venueName: 'DY Patil Stadium, Navi Mumbai',
    fanName: 'Fan',
    seat: 'N-Block-Row-G-Seat-14',
    stand: 'North Stand',
    gate: 'Gate B',
    gateWaitMin: 6,
    foodStallName: 'Food Court Central',
    foodWaitMin: 5,
    zoneDensity: 'MEDIUM',
    alertList: 'None',
    emergencyActive: false,
    emergencyExits: ['Gate B Exit', 'Emergency Exit N1'],
  };

  // Try to get real fan data
  if (fan_id) {
    try {
      const ticket = await prisma.ticket.findFirst({
        where: { userId: fan_id },
        include: { event: { include: { venue: true } } },
      });

      if (ticket) {
        fanContext.fanName = 'Fan';
        fanContext.seat = ticket.seatNumber;
        fanContext.stand = ticket.standAssigned;
        fanContext.gate = ticket.gateAssigned;
        fanContext.eventName = ticket.event.name;
        fanContext.venueName = ticket.event.venue.name;
        fanContext.emergencyActive = ticket.event.emergencyActive;
      }
    } catch { /* use defaults */ }
  }

  // Get live zone data
  try {
    const engine = getSimulationEngine();
    const state = engine.getState();
    fanContext.emergencyActive = false; // check DB for this

    // Gate wait from simulation
    const gateB = state.gates.find(g => g.id === 'gate-b');
    if (gateB) fanContext.gateWaitMin = gateB.waitMinutes;

    // Food court
    const foodCentral = state.zones.find(z => z.id === 'zone-food-court-central');
    if (foodCentral) fanContext.foodWaitMin = foodCentral.waitMinutes;

    // Zone density for their stand
    const northStand = state.zones.find(z => z.id === 'zone-north-stand');
    if (northStand) fanContext.zoneDensity = northStand.density;

    // Active alerts
    const alerts = MOCK_ALERTS.filter(a => !a.resolved);
    fanContext.alertList = alerts.length > 0
      ? alerts.map(a => a.message.split(':')[0]).join('; ')
      : 'None';
  } catch { /* engine not started, use defaults */ }

  const systemPrompt = buildFlowBotSystemPrompt(fanContext);
  await streamFlowBot(message, systemPrompt, res);
});

// POST /api/ai/recommend — FlowAgent
router.post('/recommend', async (req: Request, res: Response): Promise<void> => {
  try {
    let simulationState;

    try {
      const engine = getSimulationEngine();
      simulationState = JSON.stringify(engine.getState(), null, 2);
    } catch {
      simulationState = JSON.stringify({ phase: 'MATCH_LIVE', zones: [], message: 'Simulation not running' });
    }

    const response = await runFlowAgent(simulationState);

    // Save to DB
    try {
      await prisma.aiRecommendation.create({
        data: {
          eventId: SEED_EVENT_ID,
          recommendations: response as any,
        },
      });
    } catch { /* DB unavailable */ }

    res.json(response);
  } catch (err: any) {
    res.status(500).json({ error: 'AI recommendation failed', details: err.message });
  }
});

// POST /api/ai/predict-queue
router.post('/predict-queue', async (req: Request, res: Response): Promise<void> => {
  const { gate_id } = req.body;

  // Simple rule-based prediction for now
  let prediction = {
    gate_id,
    current_wait_minutes: 6,
    predicted_15min: 8,
    predicted_30min: 12,
    recommendation: 'Expect moderate queues at halftime. Consider arriving 10 minutes before break.',
    confidence: 72,
  };

  try {
    const gateData = await redisGet(`gate:${gate_id}:queue`);
    if (gateData) {
      const gate = JSON.parse(gateData);
      prediction.current_wait_minutes = gate.waitMinutes;
      prediction.predicted_15min = Math.round(gate.waitMinutes * 1.3);
      prediction.predicted_30min = Math.round(gate.waitMinutes * 1.6);
    }
  } catch { /* use defaults */ }

  res.json(prediction);
});

// POST /api/ai/predict — FlowAgent structured predictions via Vertex AI Gemini 2.0 Flash
router.post('/predict', async (req: Request, res: Response): Promise<void> => {
  const { zones, phase, totalFans, capacity } = req.body;

  if (!zones || !Array.isArray(zones) || zones.length === 0) {
    res.status(400).json({ success: false, error: 'zones array required' });
    return;
  }

  // Enrich zones with live simulation data if available
  let enrichedZones: PredictZone[] = zones;
  try {
    const engine = getSimulationEngine();
    const state = engine.getState();
    enrichedZones = zones.map((z: PredictZone) => {
      const live = state.zones.find((lz: any) => lz.name === z.name || lz.id === z.id);
      return live ? { ...z, occ: live.count ?? z.occ } : z;
    });
  } catch { /* use client-provided data */ }

  const startTime = Date.now();

  try {
    const predictions = await generatePredictions(
      enrichedZones,
      phase || 'MATCH_LIVE',
      totalFans || enrichedZones.reduce((s, z) => s + z.occ, 0),
      capacity || 42000
    );

    const latencyMs = Date.now() - startTime;

    // Log to Google Cloud Logging (async, non-blocking)
    await Promise.all([
      logPredictionEvent(predictions, latencyMs),
      logOperationalEvent('prediction_generated', {
        phaseContext: phase,
        zoneCount: enrichedZones.length,
        latencyMs,
        model: MODEL_ID,
        severity: 'INFO',
      }),
    ]);

    res.json({ success: true, predictions, latencyMs });
  } catch (err: any) {
    console.error('[/api/ai/predict] Error:', err.message);
    await logOperationalEvent('prediction_error', {
      error: err.message,
      severity: 'ERROR',
    });
    res.json({
      success: false,
      predictions: getFallbackPredictions(enrichedZones),
    });
  }
});

// POST /api/ai/zone-intel — Deep zone analysis via Vertex AI
router.post('/zone-intel', async (req: Request, res: Response): Promise<void> => {
  const { zone, allZones, phase } = req.body;

  if (!zone) {
    res.status(400).json({ success: false, error: 'zone required' });
    return;
  }

  try {
    const intel = await generateZoneIntelligence(
      zone,
      allZones || [],
      phase || 'MATCH_LIVE'
    );

    await logOperationalEvent('zone_intel_requested', {
      zoneName: zone.name,
      zoneOccupancy: Math.round((zone.occ / zone.cap) * 100),
      severity: 'INFO',
    });

    res.json({ success: true, intel });
  } catch (err: any) {
    console.error('[/api/ai/zone-intel] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/ai/announce — AI-generated PA announcement via Vertex AI
router.post('/announce', async (req: Request, res: Response): Promise<void> => {
  const { zone, altZone } = req.body;

  if (!zone || !altZone) {
    res.status(400).json({ success: false, error: 'zone and altZone required' });
    return;
  }

  try {
    const announcement = await generatePAnnouncement(zone, altZone);

    await logOperationalEvent('pa_announcement_generated', {
      targetZone: zone.name,
      altZone: altZone.name,
      severity: 'INFO',
    });

    res.json({ success: true, announcement });
  } catch (err: any) {
    console.error('[/api/ai/announce] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
