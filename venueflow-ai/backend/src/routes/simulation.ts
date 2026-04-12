import { Router, Request, Response } from 'express';
import { getSimulationEngine, resetSimulationEngine, SimPhase } from '../services/SimulationEngine';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { SEED_EVENT_ID } from '../config/mockData';

const router = Router();

// GET /api/simulation/state
router.get('/state', (req: Request, res: Response): void => {
  try {
    const engine = getSimulationEngine();
    res.json(engine.getState());
  } catch {
    res.json({
      phase: 'GATES_OPEN',
      elapsedMinutes: 0,
      totalFansInside: 0,
      eventId: SEED_EVENT_ID,
      zones: [],
      gates: [],
      surgeActive: false,
      surgeZoneId: null,
      lastUpdated: new Date().toISOString(),
    });
  }
});

// POST /api/simulation/control
router.post('/control', authenticate, requireRole('MANAGER', 'ADMIN'), (req: AuthRequest, res: Response): void => {
  const { action, phase } = req.body;

  try {
    const engine = getSimulationEngine();

    switch (action) {
      case 'pause':
        engine.pause();
        res.json({ success: true, action: 'paused' });
        break;
      case 'resume':
        engine.resume();
        res.json({ success: true, action: 'resumed' });
        break;
      case 'reset':
        engine.reset();
        res.json({ success: true, action: 'reset' });
        break;
      case 'phase-skip':
        if (!phase) {
          res.status(400).json({ error: 'phase required for phase-skip' });
          return;
        }
        engine.skipToPhase(phase as SimPhase);
        res.json({ success: true, action: 'phase-skip', phase });
        break;
      case 'surge':
        engine.triggerSurge(req.body.zoneId);
        res.json({ success: true, action: 'surge', zoneId: req.body.zoneId });
        break;
      default:
        res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err: any) {
    res.status(500).json({ error: 'Simulation control failed', details: err.message });
  }
});

// GET /api/simulation/history (last 30 min snapshots from DB)
router.get('/history', async (req: Request, res: Response): Promise<void> => {
  try {
    const { prisma } = await import('../lib/prisma');
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);

    const snapshots = await prisma.crowdSnapshot.findMany({
      where: {
        eventId: SEED_EVENT_ID,
        recordedAt: { gte: thirtyMinAgo },
      },
      orderBy: { recordedAt: 'asc' },
      include: { zone: { select: { name: true } } },
    });

    res.json(snapshots);
  } catch {
    // Return mock history
    const mockHistory = [];
    const now = Date.now();
    for (let i = 30; i >= 0; i--) {
      mockHistory.push({
        recordedAt: new Date(now - i * 60 * 1000).toISOString(),
        count: Math.round(15000 + Math.random() * 10000),
        densityLevel: i > 20 ? 'LOW' : i > 10 ? 'MEDIUM' : 'HIGH',
        zoneId: 'zone-north-stand',
        zone: { name: 'North Stand' },
      });
    }
    res.json(mockHistory);
  }
});

export default router;
