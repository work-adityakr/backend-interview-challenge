import { Task, SyncQueueItem } from './';


const validTask: Task = {
  id: 'client-uuid-123',
  title: 'My Valid Task',
  completed: false,
  created_at: new Date(),
  updated_at: new Date(),
  is_deleted: false,
  description: 'This is a description',
  sync_status: 'pending',
};


console.log('--- Testing Type Errors (You SHOULD see errors below this line) ---');

// @ts-expect-error
const missingTitleTask: Task = {
  id: 'task-789',
  completed: false,
  created_at: new Date(),
  updated_at: new Date(),
  is_deleted: false,
};

// @ts-expect-error
const invalidOperationItem: SyncQueueItem = {
  id: 'queue-item-000',
  task_id: 'client-uuid-123',
  operation: 'INVALID_OPERATION', 
  data: validTask,
  created_at: new Date(),
  retry_count: 0,
};

export {};