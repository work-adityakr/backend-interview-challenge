import express from 'express';
import { TaskService } from '../services/taskService';

export function createTaskRouter(svc: TaskService) {
  const router = express.Router();

  router.get('/', async (_req, res, next) => { 
    try {
      const tasks = await svc.getAllTasks();
      return res.json({ data: tasks }); 
    } catch (err) {
      return next(err); 
    }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      const task = await svc.getTask(req.params.id);
      if (!task) return res.status(404).json({ error: 'Task not found' });
      return res.json({ data: task }); 
    } catch (err) {
      return next(err); 
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      const taskData = req.body;
      if (!taskData.title || typeof taskData.title !== 'string') {
        return res.status(400).json({ error: 'title is required' });
      }
      if (!taskData.id || typeof taskData.id !== 'string') {
         return res.status(400).json({ error: 'client-generated id is required' });
      }
      const task = await svc.createTask(taskData);
      return res.status(201).json({ data: task }); 
    } catch (err) {
      return next(err); 
    }
  });

  router.put('/:id', async (req, res, next) => {
    try {
      const updated = await svc.updateTask(req.params.id, req.body);
      if (!updated) return res.status(404).json({ error: 'Task not found' });
      return res.json({ data: updated }); 
    } catch (err) {
      return next(err); 
    }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      const ok = await svc.deleteTask(req.params.id);
      if (!ok) return res.status(404).json({ error: 'Task not found' });
      return res.status(204).send(); 
    } catch (err) {
      return next(err); 
    }
  });

  return router;
}