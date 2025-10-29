import { v4 as uuidv4 } from 'uuid';
import { Database } from '../db/database';
import { Task } from '../types';

export class TaskService {
  constructor(private db: Database) {}


  async createTask(taskData: Partial<Task>): Promise<Task> {
    const now = new Date().toISOString();
    const title = (taskData.title || '').trim();
    if (!title) throw new Error('title is required');


    const task: Task = {
      id: taskData.id || uuidv4(), 
      title: title,
      description: taskData.description || undefined,
      completed: taskData.completed ?? false,
      created_at: new Date(now),
      updated_at: new Date(now),
      is_deleted: false,
      sync_status: 'synced',
      server_id: uuidv4(),
      last_synced_at: new Date(now),
    };

    const insertSql = `
      INSERT INTO tasks (id, title, description, completed, created_at, updated_at, is_deleted, sync_status, server_id, last_synced_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await this.db.run(insertSql, [
      task.id,
      task.title,
      task.description,
      task.completed ? 1 : 0,
      now,
      now,
      0,
      task.sync_status,
      task.server_id,
      now,
    ]);

    return this.mapRowToTask(await this.getTaskRow(task.id));
  }


  async updateTask(id: string, updates: Partial<Task>): Promise<Task | null> {
    const existing = await this.getTaskRow(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    
    const fields: any = {};
    if (updates.title !== undefined) fields.title = updates.title;
    if (updates.description !== undefined) fields.description = updates.description;
    if (updates.completed !== undefined) fields.completed = updates.completed ? 1 : 0;
    
    const fieldKeys = Object.keys(fields);
    if (fieldKeys.length === 0) {
      return this.mapRowToTask(existing);
    }

    fields.updated_at = now;
    fields.last_synced_at = now;

    const setClause = fieldKeys.map(key => `${key} = ?`).join(', ');
    const params = [...Object.values(fields), id];

    const updateSql = `UPDATE tasks SET ${setClause} WHERE id = ?`;
    await this.db.run(updateSql, params);

    return this.mapRowToTask(await this.getTaskRow(id));
  }

 
  async deleteTask(id: string): Promise<boolean> {
    const existing = await this.getTaskRow(id);
    if (!existing) return false;

    const now = new Date().toISOString();
    await this.db.run(
      `UPDATE tasks SET is_deleted = 1, updated_at = ?, last_synced_at = ?, sync_status = 'synced' WHERE id = ?`,
      [now, now, id]
    );
    return true;
  }

 
  async getTask(id: string): Promise<Task | null> {
    const row = await this.getTaskRow(id);
    if (!row || row.is_deleted) return null;
    return this.mapRowToTask(row);
  }

  async getAllTasks(): Promise<Task[]> {
    const rows = await this.db.all('SELECT * FROM tasks WHERE is_deleted = 0 ORDER BY created_at DESC', []);
    return rows.map(this.mapRowToTask);
  }

  private async getTaskRow(id: string): Promise<any> {
    return await this.db.get('SELECT * FROM tasks WHERE id = ?', [id]);
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