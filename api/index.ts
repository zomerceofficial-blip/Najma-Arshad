import type { Request, Response } from 'express';
import { createWorkspaceApp } from '../server.js';

let appPromise: ReturnType<typeof createWorkspaceApp> | null = null;

export default async function handler(req: Request, res: Response): Promise<void> {
  try {
    if (!appPromise) {
      appPromise = createWorkspaceApp();
    }
    const app = await appPromise;
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const done = () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };
      res.once('finish', done);
      res.once('close', done);
      app(req, res, (err?: unknown) => {
        if (err && !settled) {
          settled = true;
          reject(err);
        } else {
          done();
        }
      });
    });
  } catch (err) {
    appPromise = null;
    console.error('Vercel handler initialization error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Workspace API initialization failed.' });
    }
  }
}
