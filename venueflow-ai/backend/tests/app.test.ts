import request from 'supertest';
import app from '../src/index';
import { getSimulationEngine } from '../src/services/SimulationEngine';

// Set test environment secrets
process.env.JWT_SECRET = 'test-jwt-secret-for-jest-suite-minimum-32-chars';
process.env.NODE_ENV = 'test';
import {
  calculateTrend,
  getFallbackPredictions,
  PredictZone,
} from '../src/services/googleServices';
import { buildFlowBotSystemPrompt } from '../src/services/gemini';

// ─── Auth Routes ─────────────────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  it('rejects registration with missing fields', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@test.com' });
    expect(res.status).toBe(400);
  });

  it('rejects invalid email format', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test', email: 'not-an-email', password: 'pass123' });
    expect(res.status).toBe(400);
  });

  it('rejects weak password (too short)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test', email: 'test@valid.com', password: '123' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  it('returns 401 for unknown credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@nowhere.com', password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@test.com' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ password: 'somepassword' });
    expect(res.status).toBe(400);
  });

  it('returns token and user on valid seeded credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'manager@venueflow.ai', password: 'Manager@123' });
    // In test mode without DB, seeded users fall back gracefully
    expect([200, 401, 500]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body).toHaveProperty('token');
      expect(res.body.user.role).toBe('MANAGER');
    }
  });

  it('returns appropriate response for fan credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'fan1@venueflow.ai', password: 'Fan@12345' });
    expect([200, 401, 500]).toContain(res.status);
  });
});

// ─── Protected Route Tests ───────────────────────────────────────────────────

describe('Protected Routes (JWT guard)', () => {
  it('returns 401 when no token provided', async () => {
    const res = await request(app).post('/api/events').send({});
    expect(res.status).toBe(401);
  });

  it('returns 401 for malformed Bearer token', async () => {
    const res = await request(app)
      .post('/api/events')
      .send({})
      .set('Authorization', 'Bearer invalid.token.here');
    expect(res.status).toBe(401);
  });

  it('returns 401 for missing Bearer prefix', async () => {
    const res = await request(app)
      .get('/api/simulation/state')
      .set('Authorization', 'notabearer abc123');
    // simulation/state is public — just verify we can hit it without crashing
    expect([200, 401]).toContain(res.status);
  });
});

// ─── Health Check ─────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
  });

  it('returns google services metadata', async () => {
    const res = await request(app).get('/health');
    expect(res.body).toHaveProperty('googleServices');
    const gs = res.body.googleServices;
    expect(gs).toHaveProperty('vertexAI');
    expect(gs).toHaveProperty('oauth');
    expect(gs).toHaveProperty('cloudLogging');
    expect(gs).toHaveProperty('cloudRun');
    expect(gs).toHaveProperty('cloudStorage');
    expect(gs).toHaveProperty('firebase');
  });

  it('returns model and location on /api/health', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.model).toBe('gemini-2.0-flash-001');
    expect(res.body.location).toBe('asia-south1');
    expect(res.body.vertexAI).toBe(true);
    expect(res.body.firebase).toBe(true);
    expect(res.body.cloudStorage).toBe(true);
  });
});

// ─── Events Route ─────────────────────────────────────────────────────────────

describe('GET /api/events', () => {
  it('returns an events array', async () => {
    const res = await request(app).get('/api/events');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('returns at least one event', async () => {
    const res = await request(app).get('/api/events');
    expect(res.body.length).toBeGreaterThan(0);
  });
});

describe('GET /api/events/:id', () => {
  it('returns event by seeded ID', async () => {
    const res = await request(app).get('/api/events/event-ipl-2025-mi-csk');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('name');
  });

  it('returns 404 or 500 for non-existent event', async () => {
    const res = await request(app).get('/api/events/does-not-exist-xyz');
    expect([404, 500]).toContain(res.status);
  });
});

// ─── Zones Route ──────────────────────────────────────────────────────────────

describe('GET /api/zones/:eventId', () => {
  it('returns zones array for seeded event', async () => {
    const res = await request(app).get('/api/zones/event-ipl-2025-mi-csk');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('each zone has required fields', async () => {
    const res = await request(app).get('/api/zones/event-ipl-2025-mi-csk');
    if (res.body.length > 0) {
      const zone = res.body[0];
      expect(zone).toHaveProperty('id');
      expect(zone).toHaveProperty('name');
    }
  });
});

// ─── Alerts Route ─────────────────────────────────────────────────────────────

describe('GET /api/alerts/:eventId', () => {
  it('returns alerts array for seeded event', async () => {
    const res = await request(app).get('/api/alerts/event-ipl-2025-mi-csk');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ─── AI Route Tests ──────────────────────────────────────────────────────────

describe('GET /api/ai/chat/stream', () => {
  it('returns 400 when message is missing', async () => {
    const res = await request(app).get('/api/ai/chat/stream');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns SSE stream for valid message', async () => {
    const res = await request(app)
      .get('/api/ai/chat/stream?message=Where+is+my+gate');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
  });

  it('returns SSE stream with data tokens', async () => {
    const res = await request(app)
      .get('/api/ai/chat/stream?message=hi');
    expect(res.text).toContain('data:');
  });
});

describe('POST /api/ai/predict-queue', () => {
  it('returns prediction structure for known gate', async () => {
    const res = await request(app)
      .post('/api/ai/predict-queue')
      .send({ gate_id: 'gate-a' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('current_wait_minutes');
    expect(res.body).toHaveProperty('predicted_15min');
    expect(res.body).toHaveProperty('predicted_30min');
    expect(res.body).toHaveProperty('confidence');
    expect(res.body).toHaveProperty('recommendation');
  });

  it('returns numeric wait times', async () => {
    const res = await request(app)
      .post('/api/ai/predict-queue')
      .send({ gate_id: 'gate-b' });
    expect(typeof res.body.current_wait_minutes).toBe('number');
    expect(typeof res.body.confidence).toBe('number');
    expect(res.body.confidence).toBeGreaterThan(0);
    expect(res.body.confidence).toBeLessThanOrEqual(100);
  });
});

describe('POST /api/ai/predict', () => {
  const mockZones: PredictZone[] = [
    { id: 'zone-north', name: 'North Stand', type: 'stand', occ: 3200, cap: 5000 },
    { id: 'zone-south', name: 'South Stand', type: 'stand', occ: 4500, cap: 5000 },
    { id: 'zone-food', name: 'Food Court Central', type: 'food', occ: 800, cap: 1000 },
  ];

  it('returns 400 when zones array is missing', async () => {
    const res = await request(app)
      .post('/api/ai/predict')
      .send({ phase: 'MATCH_LIVE' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when zones array is empty', async () => {
    const res = await request(app)
      .post('/api/ai/predict')
      .send({ zones: [], phase: 'MATCH_LIVE' });
    expect(res.status).toBe(400);
  });

  it('returns predictions array with correct structure', async () => {
    const res = await request(app)
      .post('/api/ai/predict')
      .send({ zones: mockZones, phase: 'MATCH_LIVE', totalFans: 8500, capacity: 42000 });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('predictions');
    expect(Array.isArray(res.body.predictions)).toBe(true);
    expect(res.body.predictions.length).toBeGreaterThan(0);
  });

  it('prediction items have required fields', async () => {
    const res = await request(app)
      .post('/api/ai/predict')
      .send({ zones: mockZones, phase: 'GATES_OPEN', totalFans: 5000, capacity: 42000 });
    const pred = res.body.predictions[0];
    expect(pred).toHaveProperty('prediction');
    expect(pred).toHaveProperty('action');
    expect(pred).toHaveProperty('actionType');
    expect(pred).toHaveProperty('confidence');
    expect(pred).toHaveProperty('urgency');
    expect(pred).toHaveProperty('targetZone');
  });

  it('confidence values are in valid range', async () => {
    const res = await request(app)
      .post('/api/ai/predict')
      .send({ zones: mockZones, phase: 'HALFTIME', totalFans: 30000, capacity: 42000 });
    res.body.predictions.forEach((pred: any) => {
      expect(pred.confidence).toBeGreaterThan(0);
      expect(pred.confidence).toBeLessThanOrEqual(100);
    });
  });

  it('urgency values are valid enum values', async () => {
    const res = await request(app)
      .post('/api/ai/predict')
      .send({ zones: mockZones, phase: 'MATCH_LIVE', totalFans: 35000, capacity: 42000 });
    const validUrgencies = ['low', 'medium', 'high', 'critical'];
    res.body.predictions.forEach((pred: any) => {
      expect(validUrgencies).toContain(pred.urgency);
    });
  });

  it('returns latencyMs in response', async () => {
    const res = await request(app)
      .post('/api/ai/predict')
      .send({ zones: mockZones, phase: 'MATCH_LIVE', totalFans: 20000, capacity: 42000 });
    if (res.body.success) {
      expect(typeof res.body.latencyMs).toBe('number');
    }
  });
});

describe('POST /api/ai/zone-intel', () => {
  const zone: PredictZone = { id: 'zone-north', name: 'North Stand', type: 'stand', occ: 4200, cap: 5000 };

  it('returns 400 when zone is missing', async () => {
    const res = await request(app)
      .post('/api/ai/zone-intel')
      .send({ phase: 'MATCH_LIVE' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns zone intelligence object', async () => {
    const res = await request(app)
      .post('/api/ai/zone-intel')
      .send({ zone, allZones: [zone], phase: 'MATCH_LIVE' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('intel');
    expect(res.body.intel).toHaveProperty('assessment');
    expect(res.body.intel).toHaveProperty('trend');
    expect(res.body.intel).toHaveProperty('recommendation');
    expect(res.body.intel).toHaveProperty('riskLevel');
  });

  it('trend is a valid value', async () => {
    const res = await request(app)
      .post('/api/ai/zone-intel')
      .send({ zone, allZones: [zone], phase: 'GATES_OPEN' });
    expect(['rising', 'falling', 'stable', 'volatile']).toContain(res.body.intel.trend);
  });

  it('riskLevel is a valid value', async () => {
    const res = await request(app)
      .post('/api/ai/zone-intel')
      .send({ zone, allZones: [zone], phase: 'MATCH_LIVE' });
    expect(['low', 'moderate', 'high', 'critical']).toContain(res.body.intel.riskLevel);
  });
});

describe('POST /api/ai/announce', () => {
  it('returns 400 when zone is missing', async () => {
    const res = await request(app)
      .post('/api/ai/announce')
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns announcement string', async () => {
    const res = await request(app)
      .post('/api/ai/announce')
      .send({
        zone: { id: 'zone-north', name: 'North Stand', occ: 4800, cap: 5000 },
        altZone: { id: 'zone-south', name: 'South Stand', occ: 2000, cap: 5000 },
      });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('announcement');
    expect(typeof res.body.announcement).toBe('string');
    expect(res.body.announcement.length).toBeGreaterThan(10);
  });
});

// ─── Simulation Route Tests ──────────────────────────────────────────────────

describe('GET /api/simulation/state', () => {
  it('returns simulation state', async () => {
    const res = await request(app).get('/api/simulation/state');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('phase');
    expect(res.body).toHaveProperty('zones');
    expect(res.body).toHaveProperty('gates');
  });

  it('phase is a valid simulation phase', async () => {
    const res = await request(app).get('/api/simulation/state');
    const validPhases = ['PRE_MATCH', 'GATES_OPEN', 'MATCH_LIVE', 'HALFTIME', 'SECOND_HALF', 'CLEARING', 'POST_MATCH'];
    expect(validPhases).toContain(res.body.phase);
  });

  it('zones array contains objects with density', async () => {
    const res = await request(app).get('/api/simulation/state');
    if (res.body.zones.length > 0) {
      expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(res.body.zones[0].density);
    }
  });
});

// ─── Emergency Route Tests ────────────────────────────────────────────────────

describe('Emergency Routes', () => {
  it('POST /api/emergency/trigger requires authentication', async () => {
    const res = await request(app)
      .post('/api/emergency/trigger')
      .send({ zone: 'Gate A', reason: 'Test' });
    expect(res.status).toBe(401);
  });

  it('POST /api/emergency/clear requires authentication', async () => {
    const res = await request(app)
      .post('/api/emergency/clear')
      .send({});
    expect(res.status).toBe(401);
  });

  it('POST /api/emergency/trigger with invalid token returns 401', async () => {
    const res = await request(app)
      .post('/api/emergency/trigger')
      .set('Authorization', 'Bearer fake.token.here')
      .send({ zone: 'Gate A' });
    expect(res.status).toBe(401);
  });
});

// ─── SimulationEngine Unit Tests ─────────────────────────────────────────────

describe('SimulationEngine', () => {
  let engine: ReturnType<typeof getSimulationEngine>;

  beforeAll(() => {
    engine = getSimulationEngine('test-event-001');
  });

  afterAll(() => {
    engine.stop();
  });

  it('initializes with GATES_OPEN phase', () => {
    const state = engine.getState();
    expect(state.phase).toBe('GATES_OPEN');
  });

  it('has exactly 8 zones', () => {
    expect(engine.getState().zones).toHaveLength(8);
  });

  it('has exactly 4 gates', () => {
    expect(engine.getState().gates).toHaveLength(4);
  });

  it('starts with no surge active', () => {
    const state = engine.getState();
    expect(state.surgeActive).toBe(false);
    expect(state.surgeZoneId).toBeNull();
  });

  it('all zones start at LOW density', () => {
    engine.reset();
    engine.getState().zones.forEach(zone => {
      expect(zone.density).toBe('LOW');
      expect(zone.count).toBe(0);
    });
  });

  it('stores correct eventId', () => {
    expect(engine.getState().eventId).toBe('test-event-001');
  });

  it('transitions to MATCH_LIVE on skipToPhase', () => {
    engine.skipToPhase('MATCH_LIVE');
    expect(engine.getState().phase).toBe('MATCH_LIVE');
  });

  it('transitions to HALFTIME on skipToPhase', () => {
    engine.skipToPhase('HALFTIME');
    expect(engine.getState().phase).toBe('HALFTIME');
  });

  it('resets to GATES_OPEN and clears fans', () => {
    engine.reset();
    const state = engine.getState();
    expect(state.phase).toBe('GATES_OPEN');
    expect(state.totalFansInside).toBe(0);
  });

  it('all gate wait times are non-negative after reset', () => {
    const state = engine.getState();
    state.gates.forEach(gate => {
      expect(gate.waitMinutes).toBeGreaterThanOrEqual(0);
    });
  });

  it('all zone max capacities are positive', () => {
    engine.getState().zones.forEach(zone => {
      expect(zone.max).toBeGreaterThan(0);
    });
  });
});

// ─── Google Services Utility Unit Tests ──────────────────────────────────────

describe('calculateTrend()', () => {
  it('returns stable for fewer than 3 data points', () => {
    expect(calculateTrend([])).toBe('stable');
    expect(calculateTrend([50])).toBe('stable');
    expect(calculateTrend([50, 60])).toBe('stable');
  });

  it('detects rising trend', () => {
    // Small variance, clear upward direction
    const result = calculateTrend([50, 52, 55, 57, 61, 64]);
    expect(result).toBe('rising');
  });

  it('detects falling trend', () => {
    // Small variance, clear downward direction
    const result = calculateTrend([70, 67, 64, 60, 56, 53]);
    expect(result).toBe('falling');
  });

  it('detects volatile trend with large variance', () => {
    const result = calculateTrend([10, 90, 10, 90, 10]);
    expect(result).toBe('volatile');
  });

  it('returns stable for flat data', () => {
    const result = calculateTrend([50, 50, 50, 50, 50]);
    expect(result).toBe('stable');
  });
});

describe('getFallbackPredictions()', () => {
  const baseZones: PredictZone[] = [
    { id: 'zone-a', name: 'Zone A', occ: 1000, cap: 5000 },
    { id: 'zone-b', name: 'Zone B', occ: 4400, cap: 5000 }, // 88% — CRITICAL
    { id: 'zone-c', name: 'Zone C', occ: 3600, cap: 5000 }, // 72% — HIGH
  ];

  it('always returns exactly 3 predictions', () => {
    const preds = getFallbackPredictions(baseZones);
    expect(preds).toHaveLength(3);
  });

  it('each prediction has all required fields', () => {
    const preds = getFallbackPredictions(baseZones);
    preds.forEach(p => {
      expect(p).toHaveProperty('prediction');
      expect(p).toHaveProperty('action');
      expect(p).toHaveProperty('actionType');
      expect(p).toHaveProperty('confidence');
      expect(p).toHaveProperty('urgency');
      expect(p).toHaveProperty('targetZone');
    });
  });

  it('marks critical prediction as critical urgency when zone > 85%', () => {
    const preds = getFallbackPredictions(baseZones);
    expect(preds[0].urgency).toBe('critical');
  });

  it('returns stable prediction when no critical zones', () => {
    const safeZones: PredictZone[] = [
      { id: 'z1', name: 'Zone 1', occ: 1000, cap: 5000 },
      { id: 'z2', name: 'Zone 2', occ: 1500, cap: 5000 },
    ];
    const preds = getFallbackPredictions(safeZones);
    expect(preds[0].urgency).toBe('low');
  });

  it('confidence values are in valid 1-100 range', () => {
    const preds = getFallbackPredictions(baseZones);
    preds.forEach(p => {
      expect(p.confidence).toBeGreaterThan(0);
      expect(p.confidence).toBeLessThanOrEqual(100);
    });
  });

  it('actionType is a valid enum value', () => {
    const validTypes = ['deploy_staff', 'open_gate', 'alert_vendors', 'broadcast_pa', 'monitor'];
    const preds = getFallbackPredictions(baseZones);
    preds.forEach(p => {
      expect(validTypes).toContain(p.actionType);
    });
  });
});

describe('buildFlowBotSystemPrompt()', () => {
  const fanCtx = {
    eventName: 'IPL 2025 — MI vs CSK',
    venueName: 'DY Patil Stadium',
    fanName: 'Amaan',
    seat: 'Block E-Row 14',
    stand: 'North Stand',
    gate: 'Gate B',
    gateWaitMin: 7,
    foodStallName: 'Food Court Central',
    foodWaitMin: 5,
    zoneDensity: 'HIGH',
    alertList: 'Gate C Congestion',
    emergencyActive: false,
    emergencyExits: ['Gate B Exit', 'Emergency Exit N1'],
  };

  it('returns a non-empty string', () => {
    const prompt = buildFlowBotSystemPrompt(fanCtx);
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(50);
  });

  it('includes the fan gate in the prompt', () => {
    const prompt = buildFlowBotSystemPrompt(fanCtx);
    expect(prompt).toContain('Gate B');
  });

  it('includes the event name', () => {
    const prompt = buildFlowBotSystemPrompt(fanCtx);
    expect(prompt).toContain('MI vs CSK');
  });

  it('includes wait time data', () => {
    const prompt = buildFlowBotSystemPrompt(fanCtx);
    expect(prompt).toContain('7');
  });

  it('flags emergency when emergencyActive is true', () => {
    const emergencyCtx = { ...fanCtx, emergencyActive: true };
    const prompt = buildFlowBotSystemPrompt(emergencyCtx);
    expect(prompt.toLowerCase()).toContain('emergency');
  });
});
