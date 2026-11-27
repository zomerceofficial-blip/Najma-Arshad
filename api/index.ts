import type { Request, Response } from 'express';
import { createWorkspaceApp } from '../server.js';

let appPromise: ReturnType<typeof createWorkspaceApp> | null = null;

export default async function handler(req: Request, res: Response) {
  try {
    if (!appPromise) {
      appPromise = createWorkspaceApp();
    }
    const app = await appPromise;
    return app(req, res);
  } catch (err) {
    appPromise = null;
    console.error('Vercel handler initialization error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Workspace API initialization failed.' });
    }
  }
}
