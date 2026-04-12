import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { MOCK_ALERTS, SEED_EVENT_ID } from '../config/mockData';

const router = Router();

// GET /api/alerts/:eventId
router.get('/:eventId', async (req: Request, res: Response): Promise<void> => {
  try {
    const alerts = await prisma.alert.findMany({
      where: { eventId: String(req.params.eventId) },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(alerts);
  } catch {
    res.json(MOCK_ALERTS);
  }
});

// POST /api/alerts
router.post('/', authenticate, requireRole('MANAGER', 'ADMIN', 'STAFF'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { eventId, zoneId, zoneName, severity, message } = req.body;
    const alert = await prisma.alert.create({
      data: { eventId, zoneId, zoneName, severity, message, aiGenerated: false },
    });
    res.status(201).json(alert);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create alert' });
  }
});

// PATCH /api/alerts/:alertId/resolve
router.patch('/:alertId/resolve', authenticate, requireRole('MANAGER', 'ADMIN', 'STAFF'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const alert = await prisma.alert.update({
      where: { id: String(req.params.alertId) },
      data: { resolved: true, resolvedAt: new Date() },
    });
    res.json(alert);
  } catch {
    res.json({ id: req.params.alertId, resolved: true, resolvedAt: new Date().toISOString() });
  }
});

export default router;
