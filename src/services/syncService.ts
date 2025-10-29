// src/services/syncService.ts
import { v4 as uuidv4 } from 'uuid';
import { Database } from '../db/database';
import { Task, SyncQueueItem, BatchSyncResponse } from '../types';
import { CHALLENGE_CONSTRAINTS } from '../utils/challenge-constraints';

type Operation = 'create' | 'update' | 'delete';

export class SyncService {
  sync() {
    throw new Error('Method not implemented.');
  }
  checkConnectivity() {
    throw new Error('Method not implemented.');
  }
  constructor(private db: Database) {}

  async processBatch(items: SyncQueueItem[]): Promise<BatchSyncResponse> {
    const results: BatchSyncResponse['processed_items'] = [];

    for (const item of items) {
      const { task_id, operation, data: clientTask } = item; 
      try {
        const serverRowByServerId = clientTask.server_id
          ? await this.db.get('SELECT * FROM tasks WHERE server_id = ?', [clientTask.server_id])
          : null;
        const serverRowById = await this.db.get('SELECT * FROM tasks WHERE id = ?', [clientTask.id]);
        
        const serverRow = serverRowByServerId ?? serverRowById;
        const serverTask = serverRow ? this.mapRowToTask(serverRow) : null;

        if (!serverTask) {
          if (operation === 'delete') {
            results.push({ client_id: task_id, server_id: null, status: 'success', resolved_data: null });
          } else {
            const newServerId = uuidv4();
            const now = new Date().toISOString();
            const createdTask = await this.execCreate(clientTask, newServerId, now);
            results.push({ client_id: task_id, server_id: newServerId, status: 'success', resolved_data: createdTask });
          }
        } else {
          const clientTs = new Date(clientTask.updated_at).getTime();
          const serverTs = new Date(serverTask.updated_at).getTime();

          if (clientTs > serverTs) {
            const updatedTask = await this.execUpdate(serverTask.server_id!, clientTask);
            results.push({ client_id: task_id, server_id: serverTask.server_id!, status: 'success', resolved_data: updatedTask });
          } else if (serverTs > clientTs) {
            results.push({ client_id: task_id, server_id: serverTask.server_id!, status: 'conflict', resolved_data: serverTask });
          } else {
            const resolvedTask = await this.resolvePriorityConflict(clientTask, serverTask, operation);
            const status = resolvedTask.id === serverTask.id ? 'conflict' : 'success'; 
            results.push({ client_id: task_id, server_id: serverTask.server_id!, status, resolved_data: resolvedTask });
          }
        }
      } catch (err: any) {
        console.error('Error processing batch item', item, err);
        results.push({
          client_id: task_id,
          server_id: null,
          status: 'error',
          error: err.message || 'Unknown processing error',
        });
      }
    }

    return { processed_items: results };
  }

 
  private async resolvePriorityConflict(clientTask: Task, serverTask: Task, operation: Operation): Promise<Task> {
    const priority: Record<Operation, number> = CHALLENGE_CONSTRAINTS.CONFLICT_PRIORITY || {
      delete: 3,
      update: 2,
      create: 1,
    };

    const localOpPriority = priority[operation] ?? 0;
    const serverOp = serverTask.is_deleted ? 'delete' : 'update';
    const serverOpPriority = priority[serverOp] ?? 0;

    if (localOpPriority > serverOpPriority) {
      return await this.execUpdate(serverTask.server_id!, clientTask);
    } else {
      return serverTask;
    }
  }


  private async execCreate(clientTask: Task, serverId: string, now: string): Promise<Task> {
    await this.db.run(
      `INSERT INTO tasks (id, title, description, completed, created_at, updated_at, is_deleted, sync_status, server_id, last_synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        clientTask.id,
        clientTask.title,
        clientTask.description,
        clientTask.completed ? 1 : 0,
        new Date(clientTask.created_at).toISOString(),
        new Date(clientTask.updated_at).toISOString(),
        clientTask.is_deleted ? 1 : 0,
        'synced',
        serverId,
        now,
      ]
    );
    const createdRow = await this.db.get('SELECT * FROM tasks WHERE id = ?', [clientTask.id]);
    return this.mapRowToTask(createdRow);
  }

  private async execUpdate(server_id: string, clientTask: Task): Promise<Task> {
    const now = new Date().toISOString();
    await this.db.run(
      `UPDATE tasks SET title = ?, description = ?, completed = ?, updated_at = ?, is_deleted = ?, sync_status = ?, last_synced_at = ?
       WHERE server_id = ?`,
      [
        clientTask.title,
        clientTask.description,
        clientTask.completed ? 1 : 0,
        new Date(clientTask.updated_at).toISOString(),
        clientTask.is_deleted ? 1 : 0,
        'synced',
        now,
        server_id,
      ]
    );
    const updatedRow = await this.db.get('SELECT * FROM tasks WHERE server_id = ?', [server_id]);
    return this.mapRowToTask(updatedRow);
  }
  
  private mapRowToTask(row: any): Task {
     return {
      id: row.id,
      title: row.title,
      description: row.description,
      completed: !!row.completed,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      is_deleted: !!row.is_deleted,
      sync_status: row.sync_status,
      server_id: row.server_id || undefined,
      last_synced_at: row.last_synced_at ? new Date(row.last_synced_at) : undefined,
    };
  }
}