import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { MOCK_EVENTS } from '../config/mockData';

const router = Router();

// GET /api/events
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const events = await prisma.event.findMany({
      include: { venue: true },
      orderBy: { date: 'desc' },
    });
    res.json(events);
  } catch {
    // Return mock data if DB unavailable
    res.json(MOCK_EVENTS);
  }
});

// GET /api/events/:id
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: String(req.params.id) },
      include: {
        venue: true,
        zones: true,
        gates: true,
      },
    });

    if (!event) {
      const mockEvent = MOCK_EVENTS.find(e => e.id === req.params.id);
      if (mockEvent) {
        res.json(mockEvent);
        return;
      }
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    res.json(event);
  } catch {
    const mockEvent = MOCK_EVENTS.find(e => e.id === req.params.id);
    if (mockEvent) {
      res.json(mockEvent);
      return;
    }
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

// POST /api/events (manager+)
router.post('/', authenticate, requireRole('MANAGER', 'ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { venueId, name, description, date, startTime, endTime, bannerUrl } = req.body;
    const event = await prisma.event.create({
      data: { venueId, name, description, date: new Date(date), startTime: new Date(startTime), endTime: new Date(endTime), bannerUrl },
      include: { venue: true },
    });
    res.status(201).json(event);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create event', details: err.message });
  }
});

// PATCH /api/events/:id (manager+)
router.patch('/:id', authenticate, requireRole('MANAGER', 'ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const event = await prisma.event.update({
      where: { id: String(req.params.id) },
      data: req.body,
    });
    res.json(event);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update event' });
  }
});

export default router;
