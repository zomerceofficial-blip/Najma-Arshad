import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { Request, Response, NextFunction } from 'express';
import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { createClient } from '@supabase/supabase-js';
import type { DocumentRecord, Project, User, WorkspaceRole } from '../types/workspace.js';
import { DATA_DIR, getDb, saveDb } from './store.js';

const SECRET_FILE = path.join(DATA_DIR, '.session-secret');
let cachedSigningKey: string | null = null;
let cachedFirebaseProjectId: string | null = null;

function getFirebaseProjectId(): string {
  if (cachedFirebaseProjectId) return cachedFirebaseProjectId;
  const envProj = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
  if (envProj && envProj.trim()) {
    cachedFirebaseProjectId = envProj.trim();
    return cachedFirebaseProjectId;
  }
  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as { projectId?: string };
      if (raw.projectId) {
        cachedFirebaseProjectId = raw.projectId;
        return cachedFirebaseProjectId;
      }
    }
  } catch {
    // ignore missing config
  }
  cachedFirebaseProjectId = 'gen-lang-client-0293770399';
  return cachedFirebaseProjectId;
}

function getFirebaseAdminAuth() {
  const projectId = getFirebaseProjectId();
  const app = getApps().length ? getApp() : initializeApp({ projectId });
  return getAuth(app);
}

export interface VerifiedExternalIdentity {
  provider: 'firebase' | 'supabase';
  subject: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
}

export async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedExternalIdentity> {
  const auth = getFirebaseAdminAuth();
  const decoded = await auth.verifyIdToken(idToken, false);
  const email = (decoded.email || '').trim().toLowerCase();
  if (!email) {
    throw new Error('Firebase account must provide a verified email address.');
  }
  const fallbackName = email.split('@')[0].replace(/[._-]+/g, ' ');
  return {
    provider: 'firebase',
    subject: `firebase|${decoded.uid}`,
    email,
    displayName: (typeof decoded.name === 'string' && decoded.name.trim()) ? decoded.name.trim().slice(0, 80) : fallbackName,
    emailVerified: Boolean(decoded.email_verified),
  };
}

export function isSupabaseServerConfigured(): boolean {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const key = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
  return Boolean(url && key);
}

export async function verifySupabaseAccessToken(accessToken: string): Promise<VerifiedExternalIdentity> {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const key = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
  if (!url || !key) {
    throw new Error('Supabase Auth is not configured on this server (set SUPABASE_URL and SUPABASE_ANON_KEY).');
  }
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) {
    throw new Error(error?.message || 'Invalid or expired Supabase session token.');
  }
  const email = (data.user.email || '').trim().toLowerCase();
  if (!email) {
    throw new Error('Supabase account must provide an email address.');
  }
  const metaName =
    typeof data.user.user_metadata?.full_name === 'string'
      ? data.user.user_metadata.full_name
      : typeof data.user.user_metadata?.name === 'string'
      ? data.user.user_metadata.name
      : email.split('@')[0].replace(/[._-]+/g, ' ');
  return {
    provider: 'supabase',
    subject: `supabase|${data.user.id}`,
    email,
    displayName: metaName.trim().slice(0, 80) || email.split('@')[0],
    emailVerified: Boolean(data.user.email_confirmed_at || data.user.confirmed_at),
  };
}

function getSigningKey(): string {
  if (cachedSigningKey) return cachedSigningKey;
  const envSecret = process.env.TRUVORNEX_SESSION_SECRET || process.env.SESSION_SECRET;
  if (envSecret && envSecret.trim().length >= 32) {
    cachedSigningKey = envSecret.trim();
    return cachedSigningKey;
  }
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
    if (fs.existsSync(SECRET_FILE)) {
      const stored = fs.readFileSync(SECRET_FILE, 'utf-8').trim();
      if (stored.length >= 32) {
        cachedSigningKey = stored;
        return cachedSigningKey;
      }
    }
    const generated = crypto.randomBytes(48).toString('hex');
    fs.writeFileSync(SECRET_FILE, generated, { encoding: 'utf-8', mode: 0o600 });
    cachedSigningKey = generated;
    return cachedSigningKey;
  } catch {
    cachedSigningKey = crypto.randomBytes(48).toString('hex');
    return cachedSigningKey;
  }
}

export type TokenScope = 'pending_keyfile' | 'full';

export interface TokenPayload {
  uid: string;
  jti: string;
  iat: number;
  iatMs?: number;
  exp: number;
  scope?: TokenScope;
}

export function signSessionToken(userId: string, ttlSeconds = 60 * 60 * 8, scope: TokenScope = 'full'): string {
  const nowMs = Date.now();
  const nowSec = Math.floor(nowMs / 1000);
  const payload: TokenPayload = {
    uid: userId,
    jti: crypto.randomBytes(16).toString('hex'),
    iat: nowSec,
    iatMs: nowMs,
    exp: nowSec + ttlSeconds,
    scope,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', getSigningKey()).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string): TokenPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;
  const expectedSig = crypto.createHmac('sha256', getSigningKey()).update(encoded).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8')) as TokenPayload;
    const nowSec = Math.floor(Date.now() / 1000);
    if (!payload.uid || !payload.jti || !payload.exp || payload.exp < nowSec) {
      return null;
    }
    const db = getDb();
    if (db.revokedJtis.some((r) => r.jti === payload.jti)) {
      return null;
    }
    const invalidBefore = db.sessionInvalidBefore[payload.uid];
    const issuedAtMs = typeof payload.iatMs === 'number' ? payload.iatMs : (payload.iat || 0) * 1000;
    if (typeof invalidBefore === 'number' && issuedAtMs <= invalidBefore) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function revokeSessionToken(token: string): void {
  if (!token) return;
  const parts = token.split('.');
  if (parts.length !== 2) return;
  try {
    const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf-8')) as TokenPayload;
    if (!payload.jti || !payload.exp) return;
    const db = getDb();
    const nowSec = Math.floor(Date.now() / 1000);
    db.revokedJtis = db.revokedJtis.filter((r) => r.exp > nowSec);
    if (!db.revokedJtis.some((r) => r.jti === payload.jti)) {
      db.revokedJtis.push({ jti: payload.jti, exp: payload.exp });
    }
    saveDb(db);
  } catch {
    // ignore malformed token
  }
}

export function invalidateUserSessions(userId: string): void {
  const db = getDb();
  db.sessionInvalidBefore[userId] = Date.now();
  saveDb(db);
}

export interface AuthenticatedRequest extends Request {
  authUser?: User;
  authToken?: string;
  correlationId?: string;
}

export function correlationMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const incoming = req.headers['x-correlation-id'];
  const correlationId =
    typeof incoming === 'string' && /^[a-zA-Z0-9_-]{6,64}$/.test(incoming)
      ? incoming
      : `corr-${crypto.randomBytes(6).toString('hex')}`;
  req.correlationId = correlationId;
  res.setHeader('X-Correlation-Id', correlationId);
  next();
}

export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  keyFn?: (req: Request) => string;
  message?: string;
}) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const now = Date.now();
    if (hits.size > 5000) {
      for (const [k, v] of hits.entries()) {
        if (v.resetAt <= now) hits.delete(k);
      }
    }
    const key = options.keyFn ? options.keyFn(req) : req.ip || 'unknown';
    const current = hits.get(key);
    if (!current || current.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }
    current.count += 1;
    if (current.count > options.max) {
      const retrySec = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retrySec));
      res.status(429).json({
        error: options.message || 'Too many requests. Please wait before trying again.',
        retryAfterSeconds: retrySec,
        correlationId: req.correlationId,
      });
      return;
    }
    next();
  };
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required', correlationId: req.correlationId });
    return;
  }
  const token = authHeader.slice('Bearer '.length).trim();
  const payload = verifySessionToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Session expired or invalid', correlationId: req.correlationId });
    return;
  }
  if (payload.scope === 'pending_keyfile') {
    res.status(403).json({ error: 'Key file verification required.', correlationId: req.correlationId });
    return;
  }
  const db = getDb();
  const user = db.users.find((u) => u.id === payload.uid);
  if (!user || user.state !== 'active') {
    res.status(403).json({ error: 'Account is suspended or revoked', correlationId: req.correlationId });
    return;
  }
  if (user.expiresAt && new Date(user.expiresAt).getTime() <= Date.now()) {
    res.status(403).json({ error: 'Time-limited collaborator access has expired', correlationId: req.correlationId });
    return;
  }
  req.authUser = user;
  req.authToken = token;
  next();
}

export function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  const normA = a.trim().toLowerCase();
  const normB = b.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normA) || !/^[a-f0-9]{64}$/.test(normB)) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(normA, 'hex'), Buffer.from(normB, 'hex'));
}

function stableSortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableSortValue);
  }
  if (value && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
      sorted[key] = stableSortValue((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(stableSortValue(value));
}

export function extractKeyfileDigests(
  keyData: unknown
): { canonicalDigest: string; secretDigest: string | null } | null {
  let parsed: unknown = keyData;
  if (typeof keyData === 'string') {
    if (keyData.length > 64 * 1024) return null;
    try {
      parsed = JSON.parse(keyData);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }
  if (hasPrototypePollutionKeys(parsed)) {
    return null;
  }
  const serialized = stableStringify(parsed);
  if (!serialized || serialized.length > 64 * 1024 || serialized === '{}') {
    return null;
  }
  const record = parsed as Record<string, unknown>;
  const secretCandidate =
    typeof record.secret === 'string'
      ? record.secret
      : typeof record.key === 'string'
      ? record.key
      : typeof record.accessKey === 'string'
      ? record.accessKey
      : typeof record.private_key === 'string'
      ? record.private_key
      : typeof record.token === 'string'
      ? record.token
      : null;

  const trimmedSecret = secretCandidate ? secretCandidate.trim() : '';
  return {
    canonicalDigest: sha256Hex(serialized),
    secretDigest: trimmedSecret ? sha256Hex(trimmedSecret) : null,
  };
}

export function isWorkspaceAdmin(role: WorkspaceRole): boolean {
  return role === 'Workspace Owner' || role === 'Workspace Administrator';
}

export function canManageProjects(role: WorkspaceRole): boolean {
  return (
    role === 'Workspace Owner' ||
    role === 'Workspace Administrator' ||
    role === 'Programme Manager' ||
    role === 'Project Manager'
  );
}

export function canEditWork(role: WorkspaceRole): boolean {
  return role !== 'Read-only Observer';
}

export function canApproveWork(role: WorkspaceRole): boolean {
  return (
    role === 'Workspace Owner' ||
    role === 'Workspace Administrator' ||
    role === 'Programme Manager' ||
    role === 'Project Manager' ||
    role === 'Team Lead' ||
    role === 'Reviewer / QA'
  );
}

export function canViewProject(user: User, project: Project): boolean {
  if (isWorkspaceAdmin(user.role) || user.role === 'Programme Manager') {
    if (project.visibility === 'restricted') {
      return project.memberIds.includes(user.id) || user.role === 'Workspace Owner';
    }
    return true;
  }
  if (user.role === 'External Collaborator') {
    return project.memberIds.includes(user.id) && project.visibility !== 'restricted';
  }
  if (project.visibility === 'restricted') {
    return project.memberIds.includes(user.id);
  }
  return true;
}

export function canViewDocument(user: User, doc: DocumentRecord, projects: Project[]): boolean {
  if (doc.projectId) {
    const project = projects.find((p) => p.id === doc.projectId);
    if (project && !canViewProject(user, project)) return false;
  }
  if (doc.restricted) {
    if (user.role === 'Workspace Owner') return true;
    if (user.role === 'External Collaborator') return false;
    if (doc.projectId) {
      const project = projects.find((p) => p.id === doc.projectId);
      return Boolean(project && project.memberIds.includes(user.id));
    }
    return isWorkspaceAdmin(user.role) || doc.ownerId === user.id;
  }
  return true;
}

export function recordAudit(params: {
  actorId: string;
  actorName: string;
  action: string;
  targetType: string;
  targetId: string;
  result: 'success' | 'denied';
  details: string;
  correlationId?: string;
}): void {
  const db = getDb();
  db.auditEvents.unshift({
    id: `aud-${crypto.randomBytes(5).toString('hex')}`,
    correlationId: params.correlationId || `corr-${crypto.randomBytes(6).toString('hex')}`,
    actorId: params.actorId,
    actorName: params.actorName,
    action: params.action,
    targetType: params.targetType,
    targetId: params.targetId,
    result: params.result,
    details: params.details,
    timestamp: new Date().toISOString(),
  });
  if (db.auditEvents.length > 2000) {
    db.auditEvents.length = 2000;
  }
  saveDb(db);
}

export function containsOperatorConsoleViolation(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false;
  const serialized = JSON.stringify(payload).toLowerCase();
  const forbiddenPatterns = [
    'production_operator',
    'operator_seat',
    'operator_console',
    'prod_operator',
    'operator_credential',
    'regional_cell_control',
  ];
  return forbiddenPatterns.some((p) => serialized.includes(p));
}

export function hasPrototypePollutionKeys(obj: unknown): boolean {
  if (!obj || typeof obj !== 'object') return false;
  if (Array.isArray(obj)) return obj.some(hasPrototypePollutionKeys);
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      return true;
    }
    if (hasPrototypePollutionKeys((obj as Record<string, unknown>)[key])) {
      return true;
    }
  }
  return false;
}

export function sanitizeHeaderFilename(name: string): string {
  const base = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_');
  return base.replace(/^\.+/, '') || 'attachment.bin';
}

export function isSafeSvgContent(buffer: Buffer): boolean {
  const text = buffer.toString('utf8').toLowerCase();
  const forbidden = ['<script', 'javascript:', 'onload=', 'onerror=', 'onclick=', 'onmouseover=', '<foreignobject', '<iframe', '<object', '<embed'];
  return !forbidden.some((token) => text.includes(token));
}
