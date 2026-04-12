import { Router, Request, Response } from 'express';
import { streamFlowBot, buildFlowBotSystemPrompt, runFlowAgent, runFlowAgentPredict, getFallbackPredictions, PredictZoneInput } from '../services/gemini';
import { redisGet } from '../lib/redis';
import { prisma } from '../lib/prisma';
import { getSimulationEngine } from '../services/SimulationEngine';
import { MOCK_TICKET, SEED_EVENT_ID } from '../config/mockData';
import { MOCK_ALERTS } from '../config/mockData';

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

// POST /api/ai/predict — FlowAgent structured predictions from live zone data
router.post('/predict', async (req: Request, res: Response): Promise<void> => {
  const { zones, phase, totalFans, capacity } = req.body;

  if (!zones || !Array.isArray(zones)) {
    res.status(400).json({ success: false, error: 'zones array required' });
    return;
  }

  // Enrich zones with live simulation data if available
  let enrichedZones: PredictZoneInput[] = zones;
  try {
    const engine = getSimulationEngine();
    const state = engine.getState();
    enrichedZones = zones.map((z: PredictZoneInput) => {
      const live = state.zones.find((lz: any) => lz.name === z.name || lz.id === z.id);
      if (live) {
        return { ...z, occ: live.count ?? z.occ };
      }
      return z;
    });
  } catch { /* use client-provided zone data */ }

  try {
    const predictions = await runFlowAgentPredict(
      enrichedZones,
      phase || 'MATCH_LIVE',
      totalFans || enrichedZones.reduce((s: number, z: PredictZoneInput) => s + z.occ, 0),
      capacity || 42000
    );
    res.json({ success: true, predictions });
  } catch (err: any) {
    console.error('[/api/ai/predict] Error:', err.message);
    res.json({ success: false, predictions: getFallbackPredictions(enrichedZones) });
  }
});

export default router;
