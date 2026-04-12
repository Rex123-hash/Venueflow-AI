import { Router, Request, Response } from 'express';
import { redisGet } from '../lib/redis';
import { prisma } from '../lib/prisma';
import { getSimulationEngine } from '../services/SimulationEngine';
import { DY_PATIL_MAP } from '../config/venueMap';

const router = Router();

// GET /api/zones/:eventId
router.get('/:eventId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;

    // Try to get live data from simulation engine first
    try {
      const engine = getSimulationEngine();
      const state = engine.getState();
      if (state.eventId === eventId || eventId === 'event-ipl-2025-mi-csk') {
        res.json(state.zones);
        return;
      }
    } catch { /* engine not started */ }

    // Try Redis
    const zoneIds = DY_PATIL_MAP.zones.map(z => z.id);
    const zones = await Promise.all(
      zoneIds.map(async (id) => {
        const data = await redisGet(`zone:${id}:live`);
        if (data) return JSON.parse(data);
        return null;
      })
    );

    const liveZones = zones.filter(Boolean);
    if (liveZones.length > 0) {
      res.json(liveZones);
      return;
    }

    // Fall back to DB
    const dbZones = await prisma.zone.findMany({ where: { eventId: String(eventId) } }).catch(() => null);
    if (dbZones && dbZones.length > 0) {
      res.json(dbZones);
      return;
    }

    // Return static config
    res.json(DY_PATIL_MAP.zones.map(z => ({
      id: z.id,
      name: z.name,
      label: z.label,
      max: z.maxCapacity,
      count: 0,
      density: 'LOW',
      trend: 'stable',
      waitMinutes: 0,
      zoneType: z.zoneType,
      svgPath: z.svgPath,
    })));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch zones' });
  }
});

// POST /api/zones/:zoneId/update
router.post('/:zoneId/update', async (req: Request, res: Response): Promise<void> => {
  try {
    const { zoneId } = req.params;
    const { count } = req.body;

    await prisma.zone.update({
      where: { id: String(zoneId) },
      data: { currentCount: count },
    }).catch(() => null);

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to update zone' });
  }
});

export default router;
