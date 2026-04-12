import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { SEED_EVENT_ID } from '../config/mockData';

const router = Router();

// GET /api/staff/assignments/:eventId
router.get('/assignments/:eventId', authenticate, requireRole('STAFF', 'MANAGER', 'ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json([
      { staffId: req.user?.id, zone: 'Gate B', assignment: 'Queue management', since: new Date().toISOString() },
      { staffId: 'staff-2', zone: 'North Stand', assignment: 'Section monitoring', since: new Date().toISOString() },
      { staffId: 'staff-3', zone: 'Food Court Central', assignment: 'Flow control', since: new Date().toISOString() },
    ]);
  } catch {
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});

// POST /api/incidents
router.post('/incidents', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { eventId, zoneId, category, description, photoUrl } = req.body;
    const incident = await prisma.incident.create({
      data: {
        eventId: eventId || SEED_EVENT_ID,
        zoneId,
        reportedById: req.user!.id,
        category,
        description,
        photoUrl,
      },
    });
    res.status(201).json(incident);
  } catch {
    res.status(201).json({
      id: `incident-${Date.now()}`,
      eventId: req.body.eventId || SEED_EVENT_ID,
      category: req.body.category,
      description: req.body.description,
      status: 'OPEN',
      createdAt: new Date().toISOString(),
    });
  }
});

export default router;
