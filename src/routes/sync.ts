import express from 'express';
import { SyncService } from '../services/syncService';
import { BatchSyncRequest } from '../types';

export function createSyncRouter(svc: SyncService) {
  const router = express.Router();


  router.post('/batch', express.json(), async (req, res, next) => {
    try {
      const body = req.body as BatchSyncRequest;
      if (!body || !Array.isArray(body.items)) {
        return res.status(400).json({ error: 'Invalid payload: items[] required' });
      }

      const results = await svc.processBatch(body.items);
      return res.json(results); 
    } catch (err) {
      return next(err); 
    }
  });


  router.get('/health', (_req, res) => {
    return res.json({ 
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}