import request from 'supertest';
import app from '../src/index';
import { getSimulationEngine } from '../src/services/SimulationEngine';

// ─── Auth Route Tests ────────────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  it('should reject registration with missing fields', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@test.com' }); // missing name & password
    expect(res.status).toBe(400);
  });

  it('should reject invalid email format', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test', email: 'not-an-email', password: 'pass123' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  it('should return 401 for unknown credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@nowhere.com', password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });

  it('should return 400 for missing fields', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@test.com' });
    expect(res.status).toBe(400);
  });
});

// ─── Protected Route Tests ───────────────────────────────────────────────────

describe('Protected Routes', () => {
  it('should return 401 when no token provided', async () => {
    const res = await request(app).post('/api/events').send({});
    expect(res.status).toBe(401);
  });

  it('should return 401 for malformed token', async () => {
    const res = await request(app)
      .post('/api/events')
      .send({})
      .set('Authorization', 'Bearer invalid.token.here');
    expect(res.status).toBe(401);
  });
});

// ─── AI Route Tests ──────────────────────────────────────────────────────────

describe('GET /api/ai/chat/stream', () => {
  it('should return 400 when message is missing', async () => {
    const res = await request(app).get('/api/ai/chat/stream');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('should return SSE stream when message is provided', async () => {
    const res = await request(app)
      .get('/api/ai/chat/stream?message=Where+is+my+gate');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
  });
});

describe('POST /api/ai/predict-queue', () => {
  it('should return queue prediction structure', async () => {
    const res = await request(app)
      .post('/api/ai/predict-queue')
      .send({ gate_id: 'gate-a' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('current_wait_minutes');
    expect(res.body).toHaveProperty('predicted_15min');
    expect(res.body).toHaveProperty('confidence');
  });
});

// ─── Simulation Engine Tests ─────────────────────────────────────────────────

describe('SimulationEngine', () => {
  let engine: ReturnType<typeof getSimulationEngine>;

  beforeAll(() => {
    engine = getSimulationEngine('test-event-001');
  });

  afterAll(() => {
    engine.stop();
  });

  it('should initialize with GATES_OPEN phase', () => {
    const state = engine.getState();
    expect(state.phase).toBe('GATES_OPEN');
  });

  it('should have 8 zones initialized', () => {
    const state = engine.getState();
    expect(state.zones).toHaveLength(8);
  });

  it('should have 4 gates initialized', () => {
    const state = engine.getState();
    expect(state.gates).toHaveLength(4);
  });

  it('should start with no surge active', () => {
    const state = engine.getState();
    expect(state.surgeActive).toBe(false);
    expect(state.surgeZoneId).toBeNull();
  });

  it('should have all zones start at LOW density', () => {
    const state = engine.getState();
    state.zones.forEach(zone => {
      expect(zone.density).toBe('LOW');
      expect(zone.count).toBe(0);
    });
  });

  it('should correctly set eventId', () => {
    const state = engine.getState();
    expect(state.eventId).toBe('test-event-001');
  });

  it('should skip to MATCH_LIVE phase', () => {
    engine.skipToPhase('MATCH_LIVE');
    const state = engine.getState();
    expect(state.phase).toBe('MATCH_LIVE');
  });

  it('should reset back to GATES_OPEN', () => {
    engine.reset();
    const state = engine.getState();
    expect(state.phase).toBe('GATES_OPEN');
    expect(state.totalFansInside).toBe(0);
  });
});

// ─── Health Check ─────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('should return 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
  });
});
