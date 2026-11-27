import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { ATTACHMENTS_DIR, getActiveSlotCount, getDb, MAX_ACCOUNT_SLOTS, saveDb } from './src/server/store.js';
import { canApproveWork, canEditWork, canManageProjects, canViewDocument, canViewProject, containsOperatorConsoleViolation, correlationMiddleware, createRateLimiter, extractKeyfileDigests, hasPrototypePollutionKeys, invalidateUserSessions, isSafeSvgContent, isSupabaseServerConfigured, isWorkspaceAdmin, recordAudit, requireAuth, revokeSessionToken, sanitizeHeaderFilename, sha256Hex, signSessionToken, timingSafeEqualHex, verifyFirebaseIdToken, verifySessionToken, verifySupabaseAccessToken, } from './src/server/security.js';
import { detectDependencyCycle, emitActivity, emitNotification, isValidIsoDate, nextWorkPackageKey, PRIORITIES, sanitizeLabels, validateWorkPackageTransition, WORK_PACKAGE_STATUSES, WORK_PACKAGE_TYPES, } from './src/server/domain.js';
dotenv.config();
const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';
const ALLOWED_ROLES = [
    'Workspace Owner',
    'Workspace Administrator',
    'Programme Manager',
    'Project Manager',
    'Team Lead',
    'Contributor',
    'Reviewer / QA',
    'Read-only Observer',
    'External Collaborator',
];
const ALLOWED_UPLOAD_MIME = new Set([
    'text/plain',
    'text/markdown',
    'text/csv',
    'application/json',
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/svg+xml',
]);
const ALLOWED_PROJECT_STATUS = new Set(['Active', 'Planning', 'On Hold', 'Archived']);
const ALLOWED_PROJECT_HEALTH = new Set(['on_track', 'at_risk', 'off_track']);
const ALLOWED_MILESTONE_STATE = new Set(['Planned', 'At Risk', 'Achieved', 'Missed']);
const ALLOWED_DOC_CATEGORIES = new Set(['ADR', 'RFC', 'Specification', 'Runbook', 'Announcement']);
const ALLOWED_DOC_STATUS = new Set(['Draft', 'In Review', 'Accepted', 'Published', 'Superseded']);
const ALLOWED_MEMBER_STATES = new Set(['active', 'suspended', 'revoked']);
const ALLOWED_CHAT_MODES = new Set(['mentions_only', 'all_messages', 'muted']);
const ALLOWED_PRESENCE = new Set(['active', 'focus', 'reviewing', 'away']);
const WORKSPACE_OWNER_BOOTSTRAP_EMAIL = 'zomerceofficial@gmail.com';
function sanitizeUser(user, db) {
    const safe = { ...user };
    delete safe.keyfileHash;
    const keyRecord = db.userKeyfileHashes?.[user.id];
    return {
        ...safe,
        hasKeyfile: Boolean(keyRecord?.hash),
        keyfileId: keyRecord?.keyId || null,
    };
}
function isKeyfileConfiguredForUser(db, userId) {
    const envSha = (process.env.TRUVORNEX_ACCESS_KEY_SHA256 || '').trim();
    const envSecret = (process.env.TRUVORNEX_KEYFILE_SECRET || '').trim();
    return Boolean(envSha || envSecret || db.userKeyfileHashes?.[userId]?.hash || db.masterKeyfileHash);
}
export async function createWorkspaceApp() {
    const app = express();
    app.disable('x-powered-by');
    app.set('trust proxy', 1);
    // Baseline security headers (compatible with AI Studio iframe, Vercel, Firebase Auth & Supabase Auth)
    app.use((_req, res, next) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
        res.setHeader('X-DNS-Prefetch-Control', 'off');
        res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
        if (IS_PROD) {
            res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
            res.setHeader('Content-Security-Policy', [
                "default-src 'self'",
                "script-src 'self' 'unsafe-inline' https://apis.google.com https://accounts.google.com",
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
                "font-src 'self' https://fonts.gstatic.com",
                "img-src 'self' data: blob: https://*.googleusercontent.com",
                "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com",
                "connect-src 'self' https://*.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com wss://*.firebaseio.com wss://*.firestore.googleapis.com https://*.supabase.co wss://*.supabase.co",
                "object-src 'none'",
                "base-uri 'self'",
            ].join('; '));
        }
        next();
    });
    app.use(express.json({ limit: '4mb' }));
    app.use(correlationMiddleware);
    // Reject prototype-polluting JSON payloads across all API routes
    app.use('/api', (req, res, next) => {
        if (req.body && hasPrototypePollutionKeys(req.body)) {
            res.status(400).json({ error: 'Malformed request payload.', correlationId: req.correlationId });
            return;
        }
        next();
    });
    const apiLimiter = createRateLimiter({
        windowMs: 60 * 1000,
        max: 300,
        keyFn: (req) => req.ip || 'unknown',
    });
    const authLimiter = createRateLimiter({
        windowMs: 15 * 60 * 1000,
        max: 25,
        keyFn: (req) => {
            const body = req.body;
            const emailPart = typeof body?.email === 'string' ? body.email.trim().toLowerCase().slice(0, 80) : 'anon';
            return `${req.ip || 'unknown'}:${emailPart}`;
        },
        message: 'Too many authentication attempts. Please wait before trying again.',
    });
    app.use('/api', apiLimiter);
    // Health & OpenAPI metadata (unauthenticated operational probes)
    app.get('/api/v1/health', (_req, res) => {
        res.json({
            status: 'ok',
            service: 'truvornex-engineering-workspace',
            timestamp: new Date().toISOString(),
        });
    });
    app.get('/api/v1/openapi.json', (_req, res) => {
        res.json({
            openapi: '3.1.0',
            info: {
                title: 'Truvornex Engineering Workspace API',
                version: '2.0.0',
            },
            paths: {
                '/api/v1/health': { get: { summary: 'Readiness & health probe' } },
                '/api/v1/auth/status': { get: { summary: 'Check workspace session, slot capacity (8 max), and auth providers' } },
                '/api/v1/auth/exchange': { post: { summary: 'Verify credentials and issue short-lived pending keyfile challenge token' } },
                '/api/v1/auth/verify-keyfile': { post: { summary: 'Verify uploaded .json keyfile and upgrade pending token to full session' } },
                '/api/v1/bootstrap': { get: { summary: 'Fetch authorized workspace state' } },
                '/api/v1/me/preferences': { patch: { summary: 'Update presence and chat notification mode (mentions_only / all_messages / muted)' } },
                '/api/v1/chat/channels': { post: { summary: 'Create workspace chat channel' } },
                '/api/v1/chat/channels/{id}/messages': { post: { summary: 'Post workspace chat message with mention/all-message notification routing' } },
                '/api/v1/projects': { post: { summary: 'Create project' } },
                '/api/v1/projects/{id}': { patch: { summary: 'Update project governance and members' } },
                '/api/v1/work-packages': { post: { summary: 'Create work package' } },
                '/api/v1/work-packages/{id}': {
                    patch: { summary: 'Update work package with workflow gate checks' },
                    delete: { summary: 'Delete work package (Admin/PM)' },
                },
                '/api/v1/dependencies': { post: { summary: 'Create cycle-checked work dependency' } },
                '/api/v1/milestones/{id}': { patch: { summary: 'Update milestone target or confidence' } },
                '/api/v1/documents': { post: { summary: 'Create versioned knowledge document or ADR' } },
                '/api/v1/meetings': { post: { summary: 'Schedule engineering meeting' } },
                '/api/v1/attachments': { post: { summary: 'Upload authorized attachment' } },
                '/api/v1/attachments/{id}/download': { get: { summary: 'Download authorized attachment' } },
                '/api/v1/members/invite': { post: { summary: 'Invite member within strict 8-slot limit' } },
                '/api/v1/members/{id}': {
                    patch: { summary: 'Update member role or access state' },
                    delete: { summary: 'Remove member and release account slot' },
                },
                '/api/v1/audit/export': { get: { summary: 'Export sanitized audit log' } },
            },
        });
    });
    // --- Auth Endpoints (Firebase Auth & Supabase Auth + 8-Slot Governance) ---
    app.get('/api/v1/auth/status', (req, res) => {
        const db = getDb();
        const slotsUsed = getActiveSlotCount(db);
        const providers = {
            firebase: true,
            supabase: isSupabaseServerConfigured(),
        };
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.slice('Bearer '.length).trim();
            const payload = verifySessionToken(token);
            if (payload) {
                const user = db.users.find((u) => u.id === payload.uid);
                if (user && user.state === 'active' && (!user.expiresAt || new Date(user.expiresAt).getTime() > Date.now())) {
                    if (payload.scope === 'pending_keyfile') {
                        res.json({
                            authenticated: false,
                            keyfileRequired: true,
                            keyfileConfigured: isKeyfileConfiguredForUser(db, user.id),
                            user: sanitizeUser(user, db),
                            slotsUsed,
                            maxSlots: MAX_ACCOUNT_SLOTS,
                            providers,
                        });
                        return;
                    }
                    res.json({
                        authenticated: true,
                        keyfileRequired: false,
                        keyfileConfigured: isKeyfileConfiguredForUser(db, user.id),
                        user: sanitizeUser(user, db),
                        slotsUsed,
                        maxSlots: MAX_ACCOUNT_SLOTS,
                        providers,
                    });
                    return;
                }
            }
        }
        res.json({
            authenticated: false,
            user: null,
            slotsUsed,
            maxSlots: MAX_ACCOUNT_SLOTS,
            providers,
        });
    });
    app.post('/api/v1/auth/exchange', authLimiter, async (req, res) => {
        const { provider, token, inviteToken } = req.body;
        if ((provider !== 'firebase' && provider !== 'supabase') || typeof token !== 'string' || !token.trim()) {
            res.status(400).json({
                error: 'Valid authentication provider (firebase or supabase) and ID/access token are required.',
                correlationId: req.correlationId,
            });
            return;
        }
        let identity;
        try {
            identity =
                provider === 'firebase'
                    ? await verifyFirebaseIdToken(token.trim())
                    : await verifySupabaseAccessToken(token.trim());
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'External identity verification failed.';
            recordAudit({
                actorId: 'anonymous',
                actorName: provider,
                action: `auth.${provider}_failed`,
                targetType: 'Session',
                targetId: provider,
                result: 'denied',
                details: message,
                correlationId: req.correlationId,
            });
            res.status(401).json({ error: message, correlationId: req.correlationId });
            return;
        }
        const db = getDb();
        const providers = { firebase: true, supabase: isSupabaseServerConfigured() };
        const nowIso = new Date().toISOString();
        // 1. Check invite token if provided
        let matchedInvite = null;
        if (typeof inviteToken === 'string' && inviteToken.trim()) {
            const tokenHash = crypto.createHash('sha256').update(inviteToken.trim()).digest('hex');
            matchedInvite = db.invites.find((i) => i.tokenHash === tokenHash && !i.acceptedAt) || null;
            if (!matchedInvite || new Date(matchedInvite.expiresAt).getTime() <= Date.now()) {
                res.status(400).json({ error: 'Invitation token is invalid or expired.', correlationId: req.correlationId });
                return;
            }
            if (matchedInvite.email.toLowerCase() !== identity.email) {
                res.status(403).json({
                    error: `Invitation was issued for ${matchedInvite.email}, but signed-in account is ${identity.email}.`,
                    correlationId: req.correlationId,
                });
                return;
            }
        }
        // 2. Match existing workspace account by email or IdP subject
        let user = db.users.find((u) => u.email.toLowerCase() === identity.email || u.idpSubject === identity.subject);
        if (user) {
            if (user.state === 'suspended' || user.state === 'revoked') {
                recordAudit({
                    actorId: user.id,
                    actorName: user.displayName,
                    action: 'auth.login_denied_state',
                    targetType: 'User',
                    targetId: user.id,
                    result: 'denied',
                    details: `Blocked ${provider} sign-in because account state is ${user.state}.`,
                    correlationId: req.correlationId,
                });
                res.status(403).json({ error: 'Your workspace account has been suspended or revoked.', correlationId: req.correlationId });
                return;
            }
            if (user.expiresAt && new Date(user.expiresAt).getTime() <= Date.now()) {
                res.status(403).json({ error: 'Time-limited workspace access has expired.', correlationId: req.correlationId });
                return;
            }
            if (user.state === 'invited') {
                user.state = 'active';
            }
            user.idpSubject = identity.subject;
            user.authProvider = identity.provider;
            user.lastActiveAt = nowIso;
            if (matchedInvite) {
                matchedInvite.acceptedAt = nowIso;
            }
            saveDb(db);
        }
        else {
            // 3. New account provisioning — strictly enforce MAX_ACCOUNT_SLOTS = 8
            const slotsUsed = getActiveSlotCount(db);
            if (slotsUsed >= MAX_ACCOUNT_SLOTS) {
                recordAudit({
                    actorId: 'anonymous',
                    actorName: identity.email,
                    action: 'auth.slot_capacity_denied',
                    targetType: 'Workspace',
                    targetId: db.workspace.id,
                    result: 'denied',
                    details: `Rejected ${identity.email} (${provider}): ${slotsUsed}/${MAX_ACCOUNT_SLOTS} workspace account slots occupied.`,
                    correlationId: req.correlationId,
                });
                res.status(409).json({
                    error: `Workspace account capacity reached (${slotsUsed}/${MAX_ACCOUNT_SLOTS} slots occupied). Ask a Workspace Administrator to release an existing slot or invite you.`,
                    slotsUsed,
                    maxSlots: MAX_ACCOUNT_SLOTS,
                    correlationId: req.correlationId,
                });
                return;
            }
            const allowAutoJoin = process.env.TRUVORNEX_ALLOW_AUTO_JOIN === 'true';
            const allowlistedEmails = new Set((process.env.TRUVORNEX_ALLOWLIST_EMAILS || '')
                .split(',')
                .map((e) => e.trim().toLowerCase())
                .filter(Boolean));
            const hasActiveOwner = db.users.some((u) => u.role === 'Workspace Owner' && u.state === 'active');
            const isOwnerCandidate = identity.email === WORKSPACE_OWNER_BOOTSTRAP_EMAIL || !hasActiveOwner;
            const isAllowlisted = allowlistedEmails.has(identity.email);
            if (!allowAutoJoin && !matchedInvite && !isOwnerCandidate && !isAllowlisted) {
                recordAudit({
                    actorId: 'anonymous',
                    actorName: identity.email,
                    action: 'auth.unprovisioned_denied',
                    targetType: 'Workspace',
                    targetId: db.workspace.id,
                    result: 'denied',
                    details: `Blocked unprovisioned account ${identity.email} (${provider}). Self-registration is disabled.`,
                    correlationId: req.correlationId,
                });
                res.status(403).json({
                    error: 'Access restricted: self-registration is disabled. Only the 8 accounts provisioned by the Workspace Owner in Firebase Auth or Supabase may sign in.',
                    correlationId: req.correlationId,
                });
                return;
            }
            const assignedRole = matchedInvite
                ? matchedInvite.role
                : isOwnerCandidate
                    ? 'Workspace Owner'
                    : 'Contributor';
            user = {
                id: `usr-${crypto.randomBytes(4).toString('hex')}`,
                idpSubject: identity.subject,
                authProvider: identity.provider,
                displayName: matchedInvite?.displayName || identity.displayName,
                email: identity.email,
                title: matchedInvite?.title || (assignedRole === 'Workspace Owner' ? 'Workspace Owner' : 'Software Engineer'),
                role: assignedRole,
                state: 'active',
                mfaEnabled: true,
                timezone: db.workspace.defaultTimezone || 'UTC',
                joinedAt: nowIso,
                lastActiveAt: nowIso,
                expiresAt: null,
                presence: 'active',
                chatNotificationMode: 'mentions_only',
                notifyOnChannelAll: true,
                desktopAlerts: false,
                channelNotificationModes: {},
            };
            db.users.push(user);
            // Grant membership to internal projects so newly authenticated users can collaborate cleanly
            for (const proj of db.projects) {
                if (proj.visibility === 'internal' || assignedRole === 'Workspace Owner') {
                    if (!proj.memberIds.includes(user.id)) {
                        proj.memberIds.push(user.id);
                    }
                }
            }
            if (matchedInvite) {
                matchedInvite.acceptedAt = nowIso;
            }
            saveDb(db);
            recordAudit({
                actorId: user.id,
                actorName: user.displayName,
                action: 'member.provisioned',
                targetType: 'User',
                targetId: user.id,
                result: 'success',
                details: `Provisioned ${user.email} via ${provider} in slot ${getActiveSlotCount(db)}/${MAX_ACCOUNT_SLOTS} as ${user.role}.`,
                correlationId: req.correlationId,
            });
        }
        const pendingToken = signSessionToken(user.id, 60 * 10, 'pending_keyfile');
        const keyfileConfigured = isKeyfileConfiguredForUser(db, user.id);
        recordAudit({
            actorId: user.id,
            actorName: user.displayName,
            action: `auth.${provider}_stage1_verified`,
            targetType: 'Session',
            targetId: user.id,
            result: 'success',
            details: `Stage 1 identity verified via ${provider} (${user.email}); awaiting JSON keyfile verification.`,
            correlationId: req.correlationId,
        });
        res.json({
            authenticated: false,
            keyfileRequired: true,
            keyfileConfigured,
            pendingToken,
            user: sanitizeUser(user, db),
            slotsUsed: getActiveSlotCount(db),
            maxSlots: MAX_ACCOUNT_SLOTS,
            providers,
        });
    });
    app.post('/api/v1/auth/verify-keyfile', authLimiter, (req, res) => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ error: 'Pending login session is required before key file verification.', correlationId: req.correlationId });
            return;
        }
        const pendingToken = authHeader.slice('Bearer '.length).trim();
        const payload = verifySessionToken(pendingToken);
        if (!payload || payload.scope !== 'pending_keyfile') {
            res.status(401).json({ error: 'Pending login session expired or invalid. Please log in again.', correlationId: req.correlationId });
            return;
        }
        const db = getDb();
        const user = db.users.find((u) => u.id === payload.uid);
        if (!user || user.state !== 'active') {
            res.status(403).json({ error: 'Your workspace account has been suspended or revoked.', correlationId: req.correlationId });
            return;
        }
        if (user.expiresAt && new Date(user.expiresAt).getTime() <= Date.now()) {
            res.status(403).json({ error: 'Time-limited workspace access has expired.', correlationId: req.correlationId });
            return;
        }
        const { keyData } = (req.body || {});
        const digests = extractKeyfileDigests(keyData);
        if (!digests) {
            recordAudit({
                actorId: user.id,
                actorName: user.displayName,
                action: 'auth.keyfile_denied',
                targetType: 'Session',
                targetId: user.id,
                result: 'denied',
                details: 'Rejected malformed or empty JSON key file.',
                correlationId: req.correlationId,
            });
            res.status(400).json({ error: 'Upload a valid non-empty .json key file.', correlationId: req.correlationId });
            return;
        }
        const envSha = (process.env.TRUVORNEX_ACCESS_KEY_SHA256 || '').trim().toLowerCase();
        const envSecret = (process.env.TRUVORNEX_KEYFILE_SECRET || '').trim();
        const userKeyRecord = db.userKeyfileHashes?.[user.id];
        const masterKeyHash = db.masterKeyfileHash || null;
        const candidateHashes = [];
        if (userKeyRecord?.hash) {
            candidateHashes.push(userKeyRecord.hash);
        }
        else if (masterKeyHash) {
            candidateHashes.push(masterKeyHash);
        }
        if (/^[a-f0-9]{64}$/.test(envSha)) {
            candidateHashes.push(envSha);
        }
        if (envSecret) {
            candidateHashes.push(sha256Hex(envSecret));
        }
        let verified = false;
        if (candidateHashes.length === 0) {
            const hasActiveOwner = db.users.some((u) => u.role === 'Workspace Owner' && u.state === 'active');
            const canClaimInitialKey = user.role === 'Workspace Owner' || !hasActiveOwner;
            if (!canClaimInitialKey) {
                recordAudit({
                    actorId: user.id,
                    actorName: user.displayName,
                    action: 'auth.keyfile_unconfigured_denied',
                    targetType: 'Session',
                    targetId: user.id,
                    result: 'denied',
                    details: 'No JSON key file configured for account or workspace yet.',
                    correlationId: req.correlationId,
                });
                res.status(403).json({
                    error: 'No JSON key file has been configured for this account yet. Ask the Workspace Owner to issue your key file.',
                    correlationId: req.correlationId,
                });
                return;
            }
            const claimedHash = digests.secretDigest || digests.canonicalDigest;
            const keyId = `trv-key-${crypto.randomBytes(4).toString('hex')}`;
            db.masterKeyfileHash = claimedHash;
            db.userKeyfileHashes = db.userKeyfileHashes || {};
            db.userKeyfileHashes[user.id] = {
                hash: claimedHash,
                keyId,
                issuedAt: new Date().toISOString(),
            };
            saveDb(db);
            verified = true;
            recordAudit({
                actorId: user.id,
                actorName: user.displayName,
                action: 'auth.keyfile_initialized',
                targetType: 'Workspace',
                targetId: db.workspace.id,
                result: 'success',
                details: `Initial workspace JSON keyfile claimed by ${user.email} (${keyId}).`,
                correlationId: req.correlationId,
            });
        }
        else {
            for (const expectedHex of candidateHashes) {
                if (digests.secretDigest && timingSafeEqualHex(digests.secretDigest, expectedHex)) {
                    verified = true;
                    break;
                }
                if (timingSafeEqualHex(digests.canonicalDigest, expectedHex)) {
                    verified = true;
                    break;
                }
            }
        }
        if (!verified) {
            recordAudit({
                actorId: user.id,
                actorName: user.displayName,
                action: 'auth.keyfile_denied',
                targetType: 'Session',
                targetId: user.id,
                result: 'denied',
                details: `Rejected invalid JSON key file for ${user.email}.`,
                correlationId: req.correlationId,
            });
            res.status(403).json({ error: 'Invalid JSON key file.', correlationId: req.correlationId });
            return;
        }
        revokeSessionToken(pendingToken);
        const fullToken = signSessionToken(user.id, 60 * 60 * 8, 'full');
        user.lastActiveAt = new Date().toISOString();
        saveDb(db);
        recordAudit({
            actorId: user.id,
            actorName: user.displayName,
            action: 'auth.keyfile_verified',
            targetType: 'Session',
            targetId: user.id,
            result: 'success',
            details: `Completed two-stage JSON keyfile login for ${user.email}.`,
            correlationId: req.correlationId,
        });
        res.json({
            authenticated: true,
            keyfileRequired: false,
            keyfileConfigured: true,
            token: fullToken,
            user: sanitizeUser(user, db),
            slotsUsed: getActiveSlotCount(db),
            maxSlots: MAX_ACCOUNT_SLOTS,
            providers: { firebase: true, supabase: isSupabaseServerConfigured() },
        });
    });
    app.post('/api/v1/auth/logout', requireAuth, (req, res) => {
        if (req.authToken)
            revokeSessionToken(req.authToken);
        if (req.authUser) {
            recordAudit({
                actorId: req.authUser.id,
                actorName: req.authUser.displayName,
                action: 'auth.logout',
                targetType: 'Session',
                targetId: req.authUser.id,
                result: 'success',
                details: 'Session terminated by user.',
                correlationId: req.correlationId,
            });
        }
        res.json({ ok: true });
    });
    // Switch active role view (only for authenticated Workspace Owner / Administrator to verify RBAC boundaries safely)
    app.post('/api/v1/auth/switch-account', requireAuth, (req, res) => {
        const actor = req.authUser;
        if (actor.role !== 'Workspace Owner' && actor.role !== 'Workspace Administrator') {
            res.status(403).json({ error: 'Only Workspace Owners/Administrators can switch test identities.' });
            return;
        }
        const { targetUserId } = req.body;
        if (!targetUserId || typeof targetUserId !== 'string') {
            res.status(400).json({ error: 'targetUserId is required.' });
            return;
        }
        const db = getDb();
        const target = db.users.find((u) => u.id === targetUserId);
        if (!target || target.state !== 'active') {
            res.status(404).json({ error: 'Target active user not found.' });
            return;
        }
        if (target.role === 'Workspace Owner' && actor.role !== 'Workspace Owner') {
            recordAudit({
                actorId: actor.id,
                actorName: actor.displayName,
                action: 'auth.privilege_escalation_denied',
                targetType: 'User',
                targetId: target.id,
                result: 'denied',
                details: `${actor.displayName} (${actor.role}) blocked from switching into Workspace Owner identity.`,
                correlationId: req.correlationId,
            });
            res.status(403).json({ error: 'Workspace Administrators cannot escalate into Workspace Owner identity.' });
            return;
        }
        const token = signSessionToken(target.id);
        recordAudit({
            actorId: actor.id,
            actorName: actor.displayName,
            action: 'auth.role_context_switch',
            targetType: 'User',
            targetId: target.id,
            result: 'success',
            details: `${actor.displayName} initiated authorized workspace view as ${target.displayName} (${target.role}).`,
            correlationId: req.correlationId,
        });
        res.json({
            authenticated: true,
            user: sanitizeUser(target, db),
            token,
            slotsUsed: getActiveSlotCount(db),
            maxSlots: MAX_ACCOUNT_SLOTS,
            providers: { firebase: true, supabase: isSupabaseServerConfigured() },
        });
    });
    // --- Bootstrap Authorized State ---
    app.get('/api/v1/bootstrap', requireAuth, (req, res) => {
        const db = getDb();
        const user = req.authUser;
        const visibleProjects = db.projects.filter((p) => canViewProject(user, p));
        const visibleProjectIds = new Set(visibleProjects.map((p) => p.id));
        const workPackages = db.workPackages.filter((wp) => visibleProjectIds.has(wp.projectId));
        const visibleWpIds = new Set(workPackages.map((wp) => wp.id));
        const milestones = db.milestones.filter((m) => visibleProjectIds.has(m.projectId));
        const dependencies = db.dependencies.filter((d) => visibleWpIds.has(d.predecessorId) && visibleWpIds.has(d.successorId));
        const documents = db.documents.filter((doc) => canViewDocument(user, doc, db.projects));
        const visibleDocIds = new Set(documents.map((d) => d.id));
        const comments = db.comments.filter((c) => c.resourceType === 'work_package' ? visibleWpIds.has(c.resourceId) : visibleDocIds.has(c.resourceId));
        const attachments = db.attachments.filter((a) => {
            if (!visibleProjectIds.has(a.projectId))
                return false;
            if (a.parentType === 'document')
                return visibleDocIds.has(a.parentId);
            return visibleWpIds.has(a.parentId);
        });
        const externalLinks = db.externalLinks.filter((l) => visibleProjectIds.has(l.projectId));
        const activityEvents = db.activityEvents.filter((a) => !a.projectId || visibleProjectIds.has(a.projectId));
        const meetings = db.meetings.filter((m) => !m.projectId || visibleProjectIds.has(m.projectId));
        const notifications = db.notifications.filter((n) => n.recipientId === user.id || isWorkspaceAdmin(user.role));
        const auditEvents = isWorkspaceAdmin(user.role) || user.role === 'Programme Manager' ? db.auditEvents : [];
        const visibleChannels = db.chatChannels.filter((ch) => {
            if (ch.projectId && !visibleProjectIds.has(ch.projectId))
                return false;
            if (ch.isPrivate) {
                return (user.role === 'Workspace Owner' ||
                    isWorkspaceAdmin(user.role) ||
                    ch.createdBy === user.id ||
                    (Array.isArray(ch.memberIds) && ch.memberIds.includes(user.id)));
            }
            return true;
        });
        const visibleChannelIds = new Set(visibleChannels.map((c) => c.id));
        const chatMessages = db.chatMessages.filter((m) => visibleChannelIds.has(m.channelId));
        res.json({
            workspace: db.workspace,
            currentUser: sanitizeUser(user, db),
            users: db.users.map((u) => sanitizeUser(u, db)),
            slotsUsed: getActiveSlotCount(db),
            maxSlots: MAX_ACCOUNT_SLOTS,
            providers: {
                firebase: true,
                supabase: isSupabaseServerConfigured(),
            },
            divisions: db.divisions,
            teams: db.teams,
            projects: visibleProjects,
            milestones,
            workPackages,
            dependencies,
            comments,
            documents,
            attachments,
            integrations: isWorkspaceAdmin(user.role) || user.role !== 'External Collaborator' ? db.integrations : [],
            externalLinks,
            notifications,
            auditEvents,
            activityEvents,
            meetings,
            savedViews: db.savedViews,
            chatChannels: visibleChannels,
            chatMessages,
        });
    });
    // --- User Preferences (Presence & Chat Notification Mode: mentions_only vs all_messages vs muted) ---
    app.patch('/api/v1/me/preferences', requireAuth, (req, res) => {
        const actor = req.authUser;
        const db = getDb();
        const user = db.users.find((u) => u.id === actor.id);
        if (!user) {
            res.status(404).json({ error: 'User not found.' });
            return;
        }
        const { chatNotificationMode, notifyOnChannelAll, desktopAlerts, presence, timezone, channelNotificationModes, } = req.body;
        if (chatNotificationMode !== undefined) {
            if (!ALLOWED_CHAT_MODES.has(chatNotificationMode)) {
                res.status(400).json({ error: 'Invalid chatNotificationMode.' });
                return;
            }
            user.chatNotificationMode = chatNotificationMode;
        }
        if (typeof notifyOnChannelAll === 'boolean') {
            user.notifyOnChannelAll = notifyOnChannelAll;
        }
        if (typeof desktopAlerts === 'boolean') {
            user.desktopAlerts = desktopAlerts;
        }
        if (presence !== undefined) {
            if (!ALLOWED_PRESENCE.has(presence)) {
                res.status(400).json({ error: 'Invalid presence value.' });
                return;
            }
            user.presence = presence;
        }
        if (typeof timezone === 'string' && timezone.trim()) {
            user.timezone = timezone.trim().slice(0, 64);
        }
        if (channelNotificationModes && typeof channelNotificationModes === 'object') {
            const nextMap = { ...(user.channelNotificationModes || {}) };
            for (const [cid, mode] of Object.entries(channelNotificationModes)) {
                if (db.chatChannels.some((c) => c.id === cid) && ALLOWED_CHAT_MODES.has(mode)) {
                    nextMap[cid] = mode;
                }
            }
            user.channelNotificationModes = nextMap;
        }
        user.lastActiveAt = new Date().toISOString();
        saveDb(db);
        res.json(sanitizeUser(user, db));
    });
    // --- Workspace Chat Channels & Messages ---
    app.post('/api/v1/chat/channels', requireAuth, (req, res) => {
        const actor = req.authUser;
        if (!canEditWork(actor.role)) {
            res.status(403).json({ error: 'Read-only observers cannot create channels.' });
            return;
        }
        if (containsOperatorConsoleViolation(req.body)) {
            res.status(403).json({ error: 'Trust boundary violation.' });
            return;
        }
        const { name, topic, projectId, isPrivate } = req.body;
        if (typeof name !== 'string' || !name.trim()) {
            res.status(400).json({ error: 'Channel name is required.' });
            return;
        }
        const cleanName = name
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9-_]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 48);
        if (cleanName.length < 2) {
            res.status(400).json({ error: 'Channel name must contain at least 2 alphanumeric characters.' });
            return;
        }
        const db = getDb();
        if (db.chatChannels.some((c) => c.name.toLowerCase() === cleanName)) {
            res.status(409).json({ error: `Channel #${cleanName} already exists.` });
            return;
        }
        if (projectId) {
            const proj = db.projects.find((p) => p.id === projectId);
            if (!proj || !canViewProject(actor, proj)) {
                res.status(403).json({ error: 'Referenced project not found or access denied.' });
                return;
            }
        }
        const channel = {
            id: `ch-${crypto.randomBytes(4).toString('hex')}`,
            name: cleanName,
            topic: typeof topic === 'string' ? topic.trim().slice(0, 240) : '',
            projectId: projectId || null,
            isPrivate: Boolean(isPrivate),
            createdBy: actor.id,
            createdAt: new Date().toISOString(),
            memberIds: isPrivate ? [actor.id] : undefined,
        };
        db.chatChannels.push(channel);
        saveDb(db);
        res.status(201).json(channel);
    });
    app.post('/api/v1/chat/channels/:id/messages', requireAuth, (req, res) => {
        const actor = req.authUser;
        if (!canEditWork(actor.role)) {
            res.status(403).json({ error: 'Read-only observers cannot post workspace messages.' });
            return;
        }
        if (containsOperatorConsoleViolation(req.body)) {
            res.status(403).json({ error: 'Trust boundary violation.' });
            return;
        }
        const db = getDb();
        const channel = db.chatChannels.find((c) => c.id === req.params.id);
        if (!channel) {
            res.status(404).json({ error: 'Chat channel not found.' });
            return;
        }
        if (channel.projectId) {
            const proj = db.projects.find((p) => p.id === channel.projectId);
            if (proj && !canViewProject(actor, proj)) {
                res.status(403).json({ error: 'Access denied to channel project scope.' });
                return;
            }
        }
        if (channel.isPrivate &&
            actor.role !== 'Workspace Owner' &&
            !isWorkspaceAdmin(actor.role) &&
            channel.createdBy !== actor.id &&
            !(channel.memberIds || []).includes(actor.id)) {
            res.status(403).json({ error: 'Access denied to private channel.' });
            return;
        }
        const { body, parentMessageId } = req.body;
        if (typeof body !== 'string' || !body.trim()) {
            res.status(400).json({ error: 'Message text is required.' });
            return;
        }
        const cleanBody = body.trim().slice(0, 4000);
        let parentMsg;
        if (parentMessageId) {
            parentMsg = db.chatMessages.find((m) => m.id === parentMessageId && m.channelId === channel.id);
            if (!parentMsg) {
                res.status(404).json({ error: 'Parent thread message not found in channel.' });
                return;
            }
        }
        const lowerBody = cleanBody.toLowerCase();
        const mentions = db.users
            .filter((u) => {
            if (u.state !== 'active')
                return false;
            const firstName = u.displayName.toLowerCase().split(' ')[0];
            const fullHandle = u.displayName.toLowerCase().replace(/\s+/g, '');
            return (lowerBody.includes(`@${firstName}`) ||
                lowerBody.includes(`@${u.displayName.toLowerCase()}`) ||
                lowerBody.includes(`@${fullHandle}`));
        })
            .map((u) => u.id);
        const mentionAll = /@(all|channel|here)\b/i.test(cleanBody);
        const workKeyMatch = cleanBody.match(/#([A-Z]{2,8}-\d+)/);
        const linkedWorkKey = workKeyMatch
            ? db.workPackages.find((w) => w.key.toUpperCase() === workKeyMatch[1].toUpperCase())?.key || null
            : null;
        const nowIso = new Date().toISOString();
        const msg = {
            id: `msg-${crypto.randomBytes(5).toString('hex')}`,
            channelId: channel.id,
            authorId: actor.id,
            parentMessageId: parentMsg ? parentMsg.id : null,
            body: cleanBody,
            mentions,
            mentionAll,
            reactions: {},
            pinned: false,
            edited: false,
            linkedWorkKey,
            createdAt: nowIso,
            updatedAt: nowIso,
        };
        db.chatMessages.push(msg);
        // Notification routing honoring each member's explicit chatNotificationMode:
        // 'mentions_only' | 'all_messages' | 'muted' (global or per-channel override)
        const proj = channel.projectId ? db.projects.find((p) => p.id === channel.projectId) : undefined;
        for (const recipient of db.users) {
            if (recipient.id === actor.id || recipient.state !== 'active')
                continue;
            if (proj && !canViewProject(recipient, proj))
                continue;
            if (channel.isPrivate &&
                recipient.role !== 'Workspace Owner' &&
                !isWorkspaceAdmin(recipient.role) &&
                channel.createdBy !== recipient.id &&
                !(channel.memberIds || []).includes(recipient.id)) {
                continue;
            }
            const mode = recipient.channelNotificationModes?.[channel.id] || recipient.chatNotificationMode || 'mentions_only';
            if (mode === 'muted')
                continue;
            const isDirectMention = mentions.includes(recipient.id);
            const isThreadReplyToRecipient = Boolean(parentMsg && parentMsg.authorId === recipient.id);
            const isChannelBroadcast = mentionAll && recipient.notifyOnChannelAll !== false;
            if (mode === 'all_messages' || isDirectMention || isThreadReplyToRecipient || isChannelBroadcast) {
                emitNotification(db, {
                    recipientId: recipient.id,
                    category: isDirectMention || isChannelBroadcast ? 'mention' : 'chat',
                    title: isDirectMention
                        ? `Mentioned in #${channel.name}`
                        : isThreadReplyToRecipient
                            ? `Thread reply in #${channel.name}`
                            : `New message in #${channel.name}`,
                    summary: `${actor.displayName}: ${cleanBody.slice(0, 140)}`,
                    resourceType: 'chat_channel',
                    resourceId: channel.id,
                    securityCritical: false,
                });
            }
        }
        saveDb(db);
        res.status(201).json(msg);
    });
    app.patch('/api/v1/chat/messages/:id', requireAuth, (req, res) => {
        const actor = req.authUser;
        const db = getDb();
        const msg = db.chatMessages.find((m) => m.id === req.params.id);
        if (!msg) {
            res.status(404).json({ error: 'Message not found.' });
            return;
        }
        const isAuthor = msg.authorId === actor.id;
        if (!isAuthor && !isWorkspaceAdmin(actor.role)) {
            res.status(403).json({ error: 'Only the author or a Workspace Administrator can edit or pin this message.' });
            return;
        }
        const { body, pinned } = req.body;
        if (typeof body === 'string') {
            if (!isAuthor && !isWorkspaceAdmin(actor.role)) {
                res.status(403).json({ error: 'Only the author may edit message text.' });
                return;
            }
            if (!body.trim()) {
                res.status(400).json({ error: 'Message text cannot be empty.' });
                return;
            }
            msg.body = body.trim().slice(0, 4000);
            msg.edited = true;
        }
        if (typeof pinned === 'boolean') {
            msg.pinned = pinned;
        }
        msg.updatedAt = new Date().toISOString();
        saveDb(db);
        res.json(msg);
    });
    app.delete('/api/v1/chat/messages/:id', requireAuth, (req, res) => {
        const actor = req.authUser;
        const db = getDb();
        const msg = db.chatMessages.find((m) => m.id === req.params.id);
        if (!msg) {
            res.status(404).json({ error: 'Message not found.' });
            return;
        }
        if (msg.authorId !== actor.id && !isWorkspaceAdmin(actor.role)) {
            res.status(403).json({ error: 'Only the author or an administrator may delete this message.' });
            return;
        }
        db.chatMessages = db.chatMessages.filter((m) => m.id !== msg.id && m.parentMessageId !== msg.id);
        saveDb(db);
        res.json({ ok: true });
    });
    app.post('/api/v1/chat/messages/:id/react', requireAuth, (req, res) => {
        const actor = req.authUser;
        const db = getDb();
        const msg = db.chatMessages.find((m) => m.id === req.params.id);
        if (!msg) {
            res.status(404).json({ error: 'Message not found.' });
            return;
        }
        const { label } = req.body;
        const allowed = new Set(['👍', '✅', '👀', '🚀', 'ACK']);
        const cleanLabel = typeof label === 'string' && allowed.has(label) ? label : '👍';
        const current = msg.reactions[cleanLabel] || [];
        if (current.includes(actor.id)) {
            msg.reactions[cleanLabel] = current.filter((id) => id !== actor.id);
        }
        else {
            msg.reactions[cleanLabel] = [...current, actor.id];
        }
        saveDb(db);
        res.json(msg);
    });
    app.post('/api/v1/chat/channels/:id/read', requireAuth, (req, res) => {
        const actor = req.authUser;
        const db = getDb();
        for (const n of db.notifications) {
            if (n.recipientId === actor.id && n.resourceType === 'chat_channel' && n.resourceId === req.params.id) {
                n.read = true;
            }
        }
        saveDb(db);
        res.json({ ok: true });
    });
    // --- Global Search ---
    app.get('/api/v1/search', requireAuth, (req, res) => {
        const q = String(req.query.q || '').trim().toLowerCase().slice(0, 120);
        const db = getDb();
        const user = req.authUser;
        const visibleProjects = db.projects.filter((p) => canViewProject(user, p));
        const visibleProjectIds = new Set(visibleProjects.map((p) => p.id));
        if (!q) {
            res.json({ projects: [], workPackages: [], documents: [], users: [] });
            return;
        }
        const projects = visibleProjects.filter((p) => p.name.toLowerCase().includes(q) ||
            p.key.toLowerCase().includes(q) ||
            p.objective.toLowerCase().includes(q));
        const workPackages = db.workPackages.filter((wp) => visibleProjectIds.has(wp.projectId) &&
            (wp.key.toLowerCase().includes(q) ||
                wp.title.toLowerCase().includes(q) ||
                wp.description.toLowerCase().includes(q) ||
                wp.labels.some((l) => l.toLowerCase().includes(q))));
        const documents = db.documents.filter((doc) => canViewDocument(user, doc, db.projects) &&
            (doc.title.toLowerCase().includes(q) ||
                doc.body.toLowerCase().includes(q) ||
                doc.category.toLowerCase().includes(q)));
        const users = db.users.filter((u) => u.displayName.toLowerCase().includes(q) ||
            u.title.toLowerCase().includes(q) ||
            u.role.toLowerCase().includes(q));
        res.json({ projects, workPackages, documents, users });
    });
    // --- Projects ---
    app.post('/api/v1/projects', requireAuth, (req, res) => {
        const actor = req.authUser;
        if (!canManageProjects(actor.role)) {
            res.status(403).json({ error: 'Only Programme/Project Managers or Admins can create projects.' });
            return;
        }
        if (containsOperatorConsoleViolation(req.body)) {
            recordAudit({
                actorId: actor.id,
                actorName: actor.displayName,
                action: 'security.operator_boundary_violation',
                targetType: 'Project',
                targetId: 'new',
                result: 'denied',
                details: 'Blocked attempt to create production operator control project.',
                correlationId: req.correlationId,
            });
            res.status(403).json({ error: 'Trust boundary violation: Production Operator Console resources cannot be created here.' });
            return;
        }
        const body = req.body;
        if (typeof body.key !== 'string' ||
            typeof body.name !== 'string' ||
            typeof body.objective !== 'string' ||
            !body.key.trim() ||
            !body.name.trim() ||
            !body.objective.trim()) {
            res.status(400).json({ error: 'Project key, name, and objective are required.' });
            return;
        }
        const db = getDb();
        const cleanKey = body.key.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
        if (cleanKey.length < 2) {
            res.status(400).json({ error: 'Project key must include at least 2 alphanumeric characters.' });
            return;
        }
        if (db.projects.some((p) => p.key === cleanKey)) {
            res.status(409).json({ error: `Project key ${cleanKey} already exists.` });
            return;
        }
        const validUserIds = new Set(db.users.map((u) => u.id));
        const ownerId = typeof body.ownerId === 'string' && validUserIds.has(body.ownerId) ? body.ownerId : actor.id;
        const sponsorId = typeof body.sponsorId === 'string' && validUserIds.has(body.sponsorId) ? body.sponsorId : actor.id;
        const rawMembers = Array.isArray(body.memberIds) ? body.memberIds.filter((id) => validUserIds.has(id)) : [];
        const project = {
            id: `proj-${crypto.randomBytes(4).toString('hex')}`,
            key: cleanKey,
            name: body.name.trim().slice(0, 120),
            programme: typeof body.programme === 'string' && body.programme.trim() ? body.programme.trim().slice(0, 80) : 'Truvornex Core v1',
            objective: body.objective.trim().slice(0, 500),
            ownerId,
            sponsorId,
            status: body.status && ALLOWED_PROJECT_STATUS.has(body.status) ? body.status : 'Active',
            health: body.health && ALLOWED_PROJECT_HEALTH.has(body.health) ? body.health : 'on_track',
            healthNote: typeof body.healthNote === 'string' && body.healthNote.trim()
                ? body.healthNote.trim().slice(0, 500)
                : 'Initial project baseline established.',
            visibility: body.visibility === 'restricted' ? 'restricted' : 'internal',
            startDate: isValidIsoDate(body.startDate) ? body.startDate : '2026-11-26',
            targetDate: isValidIsoDate(body.targetDate) ? body.targetDate : '2027-02-28',
            participatingTeamIds: Array.isArray(body.participatingTeamIds)
                ? body.participatingTeamIds.filter((id) => typeof id === 'string')
                : [],
            memberIds: Array.from(new Set([actor.id, ownerId, ...rawMembers])),
            linkedDocIds: [],
        };
        db.projects.push(project);
        emitActivity(db, {
            actorId: actor.id,
            action: 'created project',
            resourceType: 'project',
            resourceId: project.id,
            resourceKey: project.key,
            resourceTitle: project.name,
            projectId: project.id,
            summary: `Created ${project.visibility} project ${project.key}.`,
        });
        saveDb(db);
        recordAudit({
            actorId: actor.id,
            actorName: actor.displayName,
            action: 'project.created',
            targetType: 'Project',
            targetId: project.key,
            result: 'success',
            details: `Created project ${project.name} (${project.visibility}).`,
            correlationId: req.correlationId,
        });
        res.status(201).json(project);
    });
    app.patch('/api/v1/projects/:id', requireAuth, (req, res) => {
        const actor = req.authUser;
        if (!canManageProjects(actor.role)) {
            res.status(403).json({ error: 'Insufficient permissions to modify project.' });
            return;
        }
        if (containsOperatorConsoleViolation(req.body)) {
            res.status(403).json({ error: 'Trust boundary violation: prohibited production operator payload.' });
            return;
        }
        const db = getDb();
        const project = db.projects.find((p) => p.id === req.params.id);
        if (!project || !canViewProject(actor, project)) {
            res.status(404).json({ error: 'Project not found or access denied.' });
            return;
        }
        const updates = req.body;
        if (updates.visibility !== undefined) {
            if (updates.visibility !== 'internal' && updates.visibility !== 'restricted') {
                res.status(400).json({ error: 'Invalid project visibility value.' });
                return;
            }
            if (updates.visibility !== project.visibility) {
                recordAudit({
                    actorId: actor.id,
                    actorName: actor.displayName,
                    action: 'project.visibility.changed',
                    targetType: 'Project',
                    targetId: project.key,
                    result: 'success',
                    details: `Changed visibility from ${project.visibility} to ${updates.visibility}.`,
                    correlationId: req.correlationId,
                });
                project.visibility = updates.visibility;
            }
        }
        if (updates.health !== undefined) {
            if (!ALLOWED_PROJECT_HEALTH.has(updates.health)) {
                res.status(400).json({ error: 'Invalid project health value.' });
                return;
            }
            project.health = updates.health;
        }
        if (typeof updates.healthNote === 'string') {
            project.healthNote = updates.healthNote.trim().slice(0, 500);
        }
        if (typeof updates.objective === 'string' && updates.objective.trim()) {
            project.objective = updates.objective.trim().slice(0, 500);
        }
        if (typeof updates.name === 'string' && updates.name.trim()) {
            project.name = updates.name.trim().slice(0, 120);
        }
        if (updates.status !== undefined) {
            if (!ALLOWED_PROJECT_STATUS.has(updates.status)) {
                res.status(400).json({ error: 'Invalid project status value.' });
                return;
            }
            project.status = updates.status;
        }
        if (isValidIsoDate(updates.targetDate)) {
            project.targetDate = updates.targetDate;
        }
        if (Array.isArray(updates.memberIds)) {
            const validUserIds = new Set(db.users.map((u) => u.id));
            const cleanMembers = Array.from(new Set([project.ownerId, ...updates.memberIds.filter((id) => typeof id === 'string' && validUserIds.has(id))]));
            project.memberIds = cleanMembers;
        }
        saveDb(db);
        res.json(project);
    });
    // --- Work Packages ---
    app.post('/api/v1/work-packages', requireAuth, (req, res) => {
        const actor = req.authUser;
        if (!canEditWork(actor.role)) {
            res.status(403).json({ error: 'Read-only observers cannot create work packages.' });
            return;
        }
        if (containsOperatorConsoleViolation(req.body)) {
            res.status(403).json({ error: 'Trust boundary violation: Production Operator Console references are prohibited.' });
            return;
        }
        const db = getDb();
        const body = req.body;
        const project = db.projects.find((p) => p.id === body.projectId);
        if (!project || !canViewProject(actor, project)) {
            res.status(404).json({ error: 'Target project not found or access denied.' });
            return;
        }
        if (typeof body.title !== 'string' || !body.title.trim() || !body.type || !WORK_PACKAGE_TYPES.has(body.type)) {
            res.status(400).json({ error: 'Valid work package title and type are required.' });
            return;
        }
        const status = body.status || 'Draft';
        if (!WORK_PACKAGE_STATUSES.has(status)) {
            res.status(400).json({ error: 'Invalid work package status.' });
            return;
        }
        const priority = body.priority || 'Medium';
        if (!PRIORITIES.has(priority)) {
            res.status(400).json({ error: 'Invalid priority.' });
            return;
        }
        const validUserIds = new Set(db.users.map((u) => u.id));
        const ownerId = typeof body.ownerId === 'string' && validUserIds.has(body.ownerId) ? body.ownerId : actor.id;
        const reviewerId = typeof body.reviewerId === 'string' && validUserIds.has(body.reviewerId) ? body.reviewerId : null;
        const milestoneId = typeof body.milestoneId === 'string' &&
            db.milestones.some((m) => m.id === body.milestoneId && m.projectId === project.id)
            ? body.milestoneId
            : null;
        const estimateRaw = Number(body.estimateHours);
        const estimateHours = Number.isFinite(estimateRaw) ? Math.min(2000, Math.max(1, Math.round(estimateRaw))) : 8;
        const now = new Date().toISOString();
        const wp = {
            id: `wp-${crypto.randomBytes(4).toString('hex')}`,
            key: nextWorkPackageKey(db, project.id),
            projectId: project.id,
            parentId: typeof body.parentId === 'string' ? body.parentId : null,
            type: body.type,
            title: body.title.trim().slice(0, 180),
            description: typeof body.description === 'string' ? body.description.trim().slice(0, 8000) : '',
            status,
            priority,
            ownerId,
            assigneeIds: Array.isArray(body.assigneeIds)
                ? body.assigneeIds.filter((id) => typeof id === 'string' && validUserIds.has(id))
                : [ownerId],
            reviewerId,
            creatorId: actor.id,
            teamId: typeof body.teamId === 'string' ? body.teamId : project.participatingTeamIds[0] || null,
            milestoneId,
            startDate: isValidIsoDate(body.startDate) ? body.startDate : '2026-11-26',
            dueDate: isValidIsoDate(body.dueDate) ? body.dueDate : '2026-12-12',
            estimateHours,
            labels: sanitizeLabels(body.labels),
            acceptanceCriteria: typeof body.acceptanceCriteria === 'string' ? body.acceptanceCriteria.trim().slice(0, 4000) : '',
            dependenciesConfirmedNone: Boolean(body.dependenciesConfirmedNone),
            blockerReason: typeof body.blockerReason === 'string' ? body.blockerReason.trim().slice(0, 500) : undefined,
            blockerOwnerId: typeof body.blockerOwnerId === 'string' && validUserIds.has(body.blockerOwnerId) ? body.blockerOwnerId : null,
            nextReviewDate: isValidIsoDate(body.nextReviewDate) ? body.nextReviewDate : undefined,
            blockerExceptionReason: typeof body.blockerExceptionReason === 'string' ? body.blockerExceptionReason.trim().slice(0, 500) : undefined,
            evidenceNote: typeof body.evidenceNote === 'string' ? body.evidenceNote.trim().slice(0, 1000) : undefined,
            highRisk: Boolean(body.highRisk),
            securityApprovedBy: null,
            version: 1,
            createdAt: now,
            updatedAt: now,
            history: [],
        };
        const gateError = validateWorkPackageTransition({
            db,
            actor,
            existing: { ...wp, status: 'Draft' },
            next: wp,
        });
        if (gateError) {
            res.status(400).json({ error: gateError });
            return;
        }
        db.workPackages.unshift(wp);
        emitActivity(db, {
            actorId: actor.id,
            action: 'created',
            resourceType: 'work_package',
            resourceId: wp.id,
            resourceKey: wp.key,
            resourceTitle: wp.title,
            projectId: wp.projectId,
            summary: `Created ${wp.type} ${wp.key} in ${wp.status}.`,
        });
        if (wp.ownerId !== actor.id) {
            emitNotification(db, {
                recipientId: wp.ownerId,
                category: 'assignment',
                title: `Assigned owner of ${wp.key}`,
                summary: `${actor.displayName} created ${wp.key}: ${wp.title}`,
                resourceType: 'work_package',
                resourceId: wp.id,
                securityCritical: false,
            });
        }
        saveDb(db);
        res.status(201).json(wp);
    });
    app.patch('/api/v1/work-packages/:id', requireAuth, (req, res) => {
        const actor = req.authUser;
        if (!canEditWork(actor.role)) {
            res.status(403).json({ error: 'Read-only observers cannot edit work packages.' });
            return;
        }
        if (containsOperatorConsoleViolation(req.body)) {
            res.status(403).json({ error: 'Trust boundary violation: Production Operator Console references are prohibited.' });
            return;
        }
        const db = getDb();
        const idx = db.workPackages.findIndex((w) => w.id === req.params.id);
        if (idx === -1) {
            res.status(404).json({ error: 'Work package not found.' });
            return;
        }
        const existing = db.workPackages[idx];
        const project = db.projects.find((p) => p.id === existing.projectId);
        if (!project || !canViewProject(actor, project)) {
            res.status(403).json({ error: 'Access denied to this project.' });
            return;
        }
        const patch = req.body;
        if (typeof patch.version === 'number' && patch.version !== existing.version) {
            res.status(409).json({
                error: `Version conflict: server is at v${existing.version}, client sent v${patch.version}. Refresh before saving.`,
            });
            return;
        }
        const validUserIds = new Set(db.users.map((u) => u.id));
        if (patch.status !== undefined && !WORK_PACKAGE_STATUSES.has(patch.status)) {
            res.status(400).json({ error: 'Invalid work package status.' });
            return;
        }
        if (patch.priority !== undefined && !PRIORITIES.has(patch.priority)) {
            res.status(400).json({ error: 'Invalid work package priority.' });
            return;
        }
        if (patch.ownerId !== undefined && !validUserIds.has(patch.ownerId)) {
            res.status(400).json({ error: 'Invalid owner user reference.' });
            return;
        }
        if (patch.reviewerId !== undefined && patch.reviewerId !== null && patch.reviewerId !== '' && !validUserIds.has(patch.reviewerId)) {
            res.status(400).json({ error: 'Invalid reviewer user reference.' });
            return;
        }
        if (patch.blockerOwnerId !== undefined && patch.blockerOwnerId !== null && patch.blockerOwnerId !== '' && !validUserIds.has(patch.blockerOwnerId)) {
            res.status(400).json({ error: 'Invalid blocker owner reference.' });
            return;
        }
        if (patch.startDate !== undefined && !isValidIsoDate(patch.startDate)) {
            res.status(400).json({ error: 'Invalid startDate format (expected YYYY-MM-DD).' });
            return;
        }
        if (patch.dueDate !== undefined && !isValidIsoDate(patch.dueDate)) {
            res.status(400).json({ error: 'Invalid dueDate format (expected YYYY-MM-DD).' });
            return;
        }
        if (patch.nextReviewDate !== undefined && patch.nextReviewDate !== '' && !isValidIsoDate(patch.nextReviewDate)) {
            res.status(400).json({ error: 'Invalid nextReviewDate format (expected YYYY-MM-DD).' });
            return;
        }
        if (patch.milestoneId !== undefined && patch.milestoneId !== null && patch.milestoneId !== '') {
            const validMs = db.milestones.some((m) => m.id === patch.milestoneId && m.projectId === existing.projectId);
            if (!validMs) {
                res.status(400).json({ error: 'Invalid milestone reference for this project.' });
                return;
            }
        }
        let securityApprovedBy = existing.securityApprovedBy || null;
        if (patch.approveSecurity === true) {
            if (!canApproveWork(actor.role)) {
                res.status(403).json({ error: 'Only Reviewers, Team Leads, Project Managers, or Admins can grant security approval.' });
                return;
            }
            if (actor.id === existing.creatorId) {
                res.status(403).json({ error: 'Separation of duties: task creator cannot self-approve high-risk security sign-off.' });
                return;
            }
            securityApprovedBy = actor.id;
            recordAudit({
                actorId: actor.id,
                actorName: actor.displayName,
                action: 'work_package.security_approved',
                targetType: 'WorkPackage',
                targetId: existing.key,
                result: 'success',
                details: `Granted independent security/reviewer sign-off on ${existing.key}.`,
                correlationId: req.correlationId,
            });
        }
        const nextTitle = typeof patch.title === 'string' && patch.title.trim() ? patch.title.trim().slice(0, 180) : existing.title;
        const nextEstimate = typeof patch.estimateHours === 'number' && Number.isFinite(patch.estimateHours)
            ? Math.min(2000, Math.max(1, Math.round(patch.estimateHours)))
            : existing.estimateHours;
        const next = {
            id: existing.id,
            key: existing.key,
            projectId: existing.projectId,
            parentId: existing.parentId ?? null,
            type: existing.type,
            title: nextTitle,
            description: typeof patch.description === 'string' ? patch.description.trim().slice(0, 8000) : existing.description,
            status: patch.status ?? existing.status,
            priority: patch.priority ?? existing.priority,
            ownerId: patch.ownerId ?? existing.ownerId,
            assigneeIds: Array.isArray(patch.assigneeIds)
                ? patch.assigneeIds.filter((id) => typeof id === 'string' && validUserIds.has(id))
                : existing.assigneeIds,
            reviewerId: patch.reviewerId === undefined ? existing.reviewerId : patch.reviewerId || null,
            creatorId: existing.creatorId,
            teamId: existing.teamId ?? null,
            milestoneId: patch.milestoneId === undefined ? existing.milestoneId : patch.milestoneId || null,
            startDate: patch.startDate ?? existing.startDate,
            dueDate: patch.dueDate ?? existing.dueDate,
            estimateHours: nextEstimate,
            labels: patch.labels !== undefined ? sanitizeLabels(patch.labels) : existing.labels,
            acceptanceCriteria: typeof patch.acceptanceCriteria === 'string' ? patch.acceptanceCriteria.trim().slice(0, 4000) : existing.acceptanceCriteria,
            dependenciesConfirmedNone: typeof patch.dependenciesConfirmedNone === 'boolean' ? patch.dependenciesConfirmedNone : existing.dependenciesConfirmedNone,
            blockerReason: typeof patch.blockerReason === 'string' ? patch.blockerReason.trim().slice(0, 500) : existing.blockerReason,
            blockerOwnerId: patch.blockerOwnerId === undefined ? existing.blockerOwnerId : patch.blockerOwnerId || null,
            nextReviewDate: typeof patch.nextReviewDate === 'string' ? patch.nextReviewDate : existing.nextReviewDate,
            blockerExceptionReason: typeof patch.blockerExceptionReason === 'string'
                ? patch.blockerExceptionReason.trim().slice(0, 500)
                : existing.blockerExceptionReason,
            evidenceNote: typeof patch.evidenceNote === 'string' ? patch.evidenceNote.trim().slice(0, 1000) : existing.evidenceNote,
            highRisk: typeof patch.highRisk === 'boolean' ? patch.highRisk : existing.highRisk,
            securityApprovedBy,
            version: existing.version + 1,
            createdAt: existing.createdAt,
            updatedAt: new Date().toISOString(),
            history: [...existing.history],
        };
        const gateError = validateWorkPackageTransition({ db, actor, existing, next });
        if (gateError) {
            res.status(400).json({ error: gateError });
            return;
        }
        const trackedFields = ['status', 'priority', 'ownerId', 'dueDate', 'title', 'milestoneId'];
        for (const field of trackedFields) {
            if (String(existing[field] ?? '') !== String(next[field] ?? '')) {
                next.history.unshift({
                    id: `hist-${crypto.randomBytes(4).toString('hex')}`,
                    field,
                    oldValue: String(existing[field] ?? ''),
                    newValue: String(next[field] ?? ''),
                    actorId: actor.id,
                    timestamp: next.updatedAt,
                });
            }
        }
        db.workPackages[idx] = next;
        if (existing.status !== next.status) {
            emitActivity(db, {
                actorId: actor.id,
                action: `moved to ${next.status}`,
                resourceType: 'work_package',
                resourceId: next.id,
                resourceKey: next.key,
                resourceTitle: next.title,
                projectId: next.projectId,
                summary: `Transitioned ${next.key} from ${existing.status} to ${next.status}.`,
            });
            if (next.status === 'In Review' && next.reviewerId) {
                emitNotification(db, {
                    recipientId: next.reviewerId,
                    category: 'review',
                    title: `Review requested on ${next.key}`,
                    summary: `${actor.displayName} moved ${next.key} to In Review.`,
                    resourceType: 'work_package',
                    resourceId: next.id,
                    securityCritical: Boolean(next.highRisk),
                });
            }
            if (next.status === 'Blocked' && next.blockerOwnerId) {
                emitNotification(db, {
                    recipientId: next.blockerOwnerId,
                    category: 'blocker',
                    title: `Blocker assigned on ${next.key}`,
                    summary: next.blockerReason || 'Work package marked Blocked.',
                    resourceType: 'work_package',
                    resourceId: next.id,
                    securityCritical: false,
                });
            }
        }
        saveDb(db);
        res.json(next);
    });
    app.delete('/api/v1/work-packages/:id', requireAuth, (req, res) => {
        const actor = req.authUser;
        if (!canManageProjects(actor.role)) {
            res.status(403).json({ error: 'Only Project/Programme Managers or Admins can delete work packages.' });
            return;
        }
        const db = getDb();
        const wp = db.workPackages.find((w) => w.id === req.params.id);
        if (!wp) {
            res.status(404).json({ error: 'Work package not found.' });
            return;
        }
        const project = db.projects.find((p) => p.id === wp.projectId);
        if (!project || !canViewProject(actor, project)) {
            res.status(403).json({ error: 'Access denied.' });
            return;
        }
        db.workPackages = db.workPackages.filter((w) => w.id !== wp.id);
        db.dependencies = db.dependencies.filter((d) => d.predecessorId !== wp.id && d.successorId !== wp.id);
        db.comments = db.comments.filter((c) => !(c.resourceType === 'work_package' && c.resourceId === wp.id));
        recordAudit({
            actorId: actor.id,
            actorName: actor.displayName,
            action: 'work_package.deleted',
            targetType: 'WorkPackage',
            targetId: wp.key,
            result: 'success',
            details: `Deleted work package ${wp.key}: ${wp.title}.`,
            correlationId: req.correlationId,
        });
        saveDb(db);
        res.json({ ok: true });
    });
    app.post('/api/v1/work-packages/:id/comments', requireAuth, (req, res) => {
        const actor = req.authUser;
        if (!canEditWork(actor.role)) {
            res.status(403).json({ error: 'Read-only observers cannot post comments.' });
            return;
        }
        const db = getDb();
        const wp = db.workPackages.find((w) => w.id === req.params.id);
        if (!wp) {
            res.status(404).json({ error: 'Work package not found.' });
            return;
        }
        const project = db.projects.find((p) => p.id === wp.projectId);
        if (!project || !canViewProject(actor, project)) {
            res.status(403).json({ error: 'Access denied.' });
            return;
        }
        const { body } = req.body;
        if (!body || typeof body !== 'string' || !body.trim()) {
            res.status(400).json({ error: 'Comment text is required.' });
            return;
        }
        const cleanBody = body.trim().slice(0, 4000);
        const mentions = db.users
            .filter((u) => cleanBody.toLowerCase().includes(`@${u.displayName.toLowerCase().split(' ')[0]}`))
            .map((u) => u.id);
        const comment = {
            id: `cmt-${crypto.randomBytes(4).toString('hex')}`,
            resourceType: 'work_package',
            resourceId: wp.id,
            authorId: actor.id,
            body: cleanBody,
            mentions,
            reactions: {},
            createdAt: new Date().toISOString(),
        };
        db.comments.push(comment);
        for (const uid of mentions) {
            if (uid !== actor.id) {
                emitNotification(db, {
                    recipientId: uid,
                    category: 'mention',
                    title: `Mentioned in ${wp.key}`,
                    summary: `${actor.displayName} mentioned you on ${wp.key}: ${wp.title}`,
                    resourceType: 'work_package',
                    resourceId: wp.id,
                    securityCritical: false,
                });
            }
        }
        emitActivity(db, {
            actorId: actor.id,
            action: 'commented on',
            resourceType: 'work_package',
            resourceId: wp.id,
            resourceKey: wp.key,
            resourceTitle: wp.title,
            projectId: wp.projectId,
            summary: comment.body.slice(0, 120),
        });
        saveDb(db);
        res.status(201).json(comment);
    });
    app.post('/api/v1/comments/:id/react', requireAuth, (req, res) => {
        const actor = req.authUser;
        const db = getDb();
        const comment = db.comments.find((c) => c.id === req.params.id);
        if (!comment) {
            res.status(404).json({ error: 'Comment not found.' });
            return;
        }
        const { label } = req.body;
        const cleanLabel = typeof label === 'string' && ['ACK', '+1', 'Verified'].includes(label) ? label : '+1';
        const current = comment.reactions[cleanLabel] || [];
        if (current.includes(actor.id)) {
            comment.reactions[cleanLabel] = current.filter((id) => id !== actor.id);
        }
        else {
            comment.reactions[cleanLabel] = [...current, actor.id];
        }
        saveDb(db);
        res.json(comment);
    });
    // --- Dependencies (Cycle-Free Guard) ---
    app.post('/api/v1/dependencies', requireAuth, (req, res) => {
        const actor = req.authUser;
        if (!canEditWork(actor.role)) {
            res.status(403).json({ error: 'Insufficient permissions.' });
            return;
        }
        const { predecessorId, successorId, type } = req.body;
        if (!predecessorId || !successorId) {
            res.status(400).json({ error: 'predecessorId and successorId are required.' });
            return;
        }
        const db = getDb();
        const pred = db.workPackages.find((w) => w.id === predecessorId);
        const succ = db.workPackages.find((w) => w.id === successorId);
        if (!pred || !succ) {
            res.status(404).json({ error: 'Referenced work package not found.' });
            return;
        }
        const predProj = db.projects.find((p) => p.id === pred.projectId);
        const succProj = db.projects.find((p) => p.id === succ.projectId);
        if (!predProj || !succProj || !canViewProject(actor, predProj) || !canViewProject(actor, succProj)) {
            res.status(403).json({ error: 'Access denied to referenced projects.' });
            return;
        }
        if (db.dependencies.some((d) => d.predecessorId === predecessorId && d.successorId === successorId)) {
            res.status(409).json({ error: 'Dependency edge already exists.' });
            return;
        }
        const cycle = detectDependencyCycle(db.dependencies, predecessorId, successorId);
        if (cycle) {
            const cycleKeys = cycle.map((id) => db.workPackages.find((w) => w.id === id)?.key || id);
            res.status(400).json({
                error: `Dependency cycle rejected: ${cycleKeys.join(' -> ')}`,
            });
            return;
        }
        const dep = {
            id: `dep-${crypto.randomBytes(4).toString('hex')}`,
            predecessorId,
            successorId,
            type: type === 'relates_to' ? 'relates_to' : 'blocks',
        };
        db.dependencies.push(dep);
        saveDb(db);
        res.status(201).json(dep);
    });
    app.delete('/api/v1/dependencies/:id', requireAuth, (req, res) => {
        const actor = req.authUser;
        if (!canEditWork(actor.role)) {
            res.status(403).json({ error: 'Insufficient permissions.' });
            return;
        }
        const db = getDb();
        const dep = db.dependencies.find((d) => d.id === req.params.id);
        if (!dep) {
            res.status(404).json({ error: 'Dependency not found.' });
            return;
        }
        const succ = db.workPackages.find((w) => w.id === dep.successorId);
        const proj = succ ? db.projects.find((p) => p.id === succ.projectId) : undefined;
        if (proj && !canViewProject(actor, proj)) {
            res.status(403).json({ error: 'Access denied.' });
            return;
        }
        db.dependencies = db.dependencies.filter((d) => d.id !== req.params.id);
        saveDb(db);
        res.json({ ok: true });
    });
    // --- Milestones ---
    app.post('/api/v1/milestones', requireAuth, (req, res) => {
        const actor = req.authUser;
        if (!canManageProjects(actor.role)) {
            res.status(403).json({ error: 'Only Project/Programme Managers or Admins can create milestones.' });
            return;
        }
        if (containsOperatorConsoleViolation(req.body)) {
            res.status(403).json({ error: 'Trust boundary violation.' });
            return;
        }
        const body = req.body;
        if (!body.projectId || typeof body.title !== 'string' || !body.title.trim() || !isValidIsoDate(body.targetDate)) {
            res.status(400).json({ error: 'projectId, title, and valid targetDate (YYYY-MM-DD) are required.' });
            return;
        }
        const db = getDb();
        const proj = db.projects.find((p) => p.id === body.projectId);
        if (!proj || !canViewProject(actor, proj)) {
            res.status(404).json({ error: 'Target project not found or access denied.' });
            return;
        }
        const conf = Number(body.confidence);
        const milestone = {
            id: `ms-${crypto.randomBytes(4).toString('hex')}`,
            projectId: body.projectId,
            title: body.title.trim().slice(0, 140),
            targetWindow: typeof body.targetWindow === 'string' && body.targetWindow.trim() ? body.targetWindow.trim().slice(0, 32) : body.targetDate.slice(0, 7),
            targetDate: body.targetDate,
            state: body.state && ALLOWED_MILESTONE_STATE.has(body.state) ? body.state : 'Planned',
            confidence: Number.isFinite(conf) ? Math.min(100, Math.max(0, Math.round(conf))) : 80,
            ownerId: typeof body.ownerId === 'string' && db.users.some((u) => u.id === body.ownerId) ? body.ownerId : actor.id,
            description: typeof body.description === 'string' ? body.description.trim().slice(0, 500) : '',
        };
        db.milestones.push(milestone);
        emitActivity(db, {
            actorId: actor.id,
            action: 'created milestone',
            resourceType: 'milestone',
            resourceId: milestone.id,
            resourceTitle: milestone.title,
            projectId: milestone.projectId,
            summary: `Target ${milestone.targetDate} (${milestone.confidence}% confidence).`,
        });
        saveDb(db);
        res.status(201).json(milestone);
    });
    app.patch('/api/v1/milestones/:id', requireAuth, (req, res) => {
        const actor = req.authUser;
        if (!canManageProjects(actor.role)) {
            res.status(403).json({ error: 'Only Project/Programme Managers or Admins can update milestones.' });
            return;
        }
        const db = getDb();
        const ms = db.milestones.find((m) => m.id === req.params.id);
        if (!ms) {
            res.status(404).json({ error: 'Milestone not found.' });
            return;
        }
        const proj = db.projects.find((p) => p.id === ms.projectId);
        if (!proj || !canViewProject(actor, proj)) {
            res.status(403).json({ error: 'Access denied.' });
            return;
        }
        const patch = req.body;
        if (typeof patch.title === 'string' && patch.title.trim())
            ms.title = patch.title.trim().slice(0, 140);
        if (isValidIsoDate(patch.targetDate))
            ms.targetDate = patch.targetDate;
        if (patch.state !== undefined) {
            if (!ALLOWED_MILESTONE_STATE.has(patch.state)) {
                res.status(400).json({ error: 'Invalid milestone state.' });
                return;
            }
            ms.state = patch.state;
        }
        if (typeof patch.confidence === 'number' && Number.isFinite(patch.confidence)) {
            ms.confidence = Math.min(100, Math.max(0, Math.round(patch.confidence)));
        }
        if (typeof patch.description === 'string')
            ms.description = patch.description.trim().slice(0, 500);
        saveDb(db);
        res.json(ms);
    });
    // --- Documents & Knowledge Base ---
    app.post('/api/v1/documents', requireAuth, (req, res) => {
        const actor = req.authUser;
        if (!canEditWork(actor.role)) {
            res.status(403).json({ error: 'Read-only observers cannot author documents.' });
            return;
        }
        if (containsOperatorConsoleViolation(req.body)) {
            res.status(403).json({ error: 'Trust boundary violation.' });
            return;
        }
        const body = req.body;
        if (typeof body.title !== 'string' || !body.title.trim() || typeof body.body !== 'string' || !body.body.trim()) {
            res.status(400).json({ error: 'Document title and body are required.' });
            return;
        }
        const db = getDb();
        if (body.projectId) {
            const proj = db.projects.find((p) => p.id === body.projectId);
            if (!proj || !canViewProject(actor, proj)) {
                res.status(403).json({ error: 'Target project not found or access denied.' });
                return;
            }
        }
        const category = body.category && ALLOWED_DOC_CATEGORIES.has(body.category) ? body.category : 'Specification';
        const status = body.status && ALLOWED_DOC_STATUS.has(body.status) ? body.status : 'Draft';
        const now = new Date().toISOString();
        const slugBase = body.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 48) || 'doc';
        const validWpIds = new Set(db.workPackages.map((w) => w.id));
        const linkedWorkIds = Array.isArray(body.linkedWorkIds)
            ? body.linkedWorkIds.filter((id) => typeof id === 'string' && validWpIds.has(id))
            : [];
        const doc = {
            id: `doc-${crypto.randomBytes(4).toString('hex')}`,
            slug: `${slugBase}-${crypto.randomBytes(2).toString('hex')}`,
            projectId: body.projectId || null,
            category,
            title: body.title.trim().slice(0, 180),
            body: body.body.slice(0, 50000),
            status,
            ownerId: actor.id,
            labels: sanitizeLabels(body.labels),
            version: 1,
            restricted: Boolean(body.restricted),
            linkedWorkIds,
            updatedAt: now,
            versions: [
                {
                    version: 1,
                    body: body.body.slice(0, 50000),
                    editorId: actor.id,
                    summary: 'Initial version',
                    createdAt: now,
                },
            ],
        };
        db.documents.unshift(doc);
        emitActivity(db, {
            actorId: actor.id,
            action: 'published',
            resourceType: 'document',
            resourceId: doc.id,
            resourceKey: doc.category,
            resourceTitle: doc.title,
            projectId: doc.projectId || undefined,
            summary: `Created ${doc.category} v1.`,
        });
        saveDb(db);
        res.status(201).json(doc);
    });
    app.patch('/api/v1/documents/:id', requireAuth, (req, res) => {
        const actor = req.authUser;
        if (!canEditWork(actor.role)) {
            res.status(403).json({ error: 'Read-only observers cannot edit documents.' });
            return;
        }
        if (containsOperatorConsoleViolation(req.body)) {
            res.status(403).json({ error: 'Trust boundary violation.' });
            return;
        }
        const db = getDb();
        const doc = db.documents.find((d) => d.id === req.params.id);
        if (!doc || !canViewDocument(actor, doc, db.projects)) {
            res.status(404).json({ error: 'Document not found or access denied.' });
            return;
        }
        const { title, body, status, summary, version, restricted, linkedWorkIds } = req.body;
        if (typeof version === 'number' && version !== doc.version) {
            res.status(409).json({
                error: `Document version conflict: server is at v${doc.version}.`,
            });
            return;
        }
        if (status !== undefined && !ALLOWED_DOC_STATUS.has(status)) {
            res.status(400).json({ error: 'Invalid document status.' });
            return;
        }
        const now = new Date().toISOString();
        if (typeof title === 'string' && title.trim())
            doc.title = title.trim().slice(0, 180);
        if (status)
            doc.status = status;
        if (typeof restricted === 'boolean')
            doc.restricted = restricted;
        if (Array.isArray(linkedWorkIds)) {
            const validWpIds = new Set(db.workPackages.map((w) => w.id));
            doc.linkedWorkIds = linkedWorkIds.filter((id) => typeof id === 'string' && validWpIds.has(id));
        }
        if (typeof body === 'string' && body !== doc.body) {
            doc.body = body.slice(0, 50000);
            doc.version += 1;
            doc.versions.push({
                version: doc.version,
                body: doc.body,
                editorId: actor.id,
                summary: typeof summary === 'string' && summary.trim() ? summary.trim().slice(0, 200) : `Updated to v${doc.version}`,
                createdAt: now,
            });
        }
        doc.updatedAt = now;
        if (doc.restricted) {
            recordAudit({
                actorId: actor.id,
                actorName: actor.displayName,
                action: 'document.restricted_updated',
                targetType: 'Document',
                targetId: doc.id,
                result: 'success',
                details: `Updated restricted document ${doc.title} to v${doc.version}.`,
                correlationId: req.correlationId,
            });
        }
        saveDb(db);
        res.json(doc);
    });
    app.post('/api/v1/documents/:id/comments', requireAuth, (req, res) => {
        const actor = req.authUser;
        if (!canEditWork(actor.role)) {
            res.status(403).json({ error: 'Read-only observers cannot post comments.' });
            return;
        }
        const db = getDb();
        const doc = db.documents.find((d) => d.id === req.params.id);
        if (!doc || !canViewDocument(actor, doc, db.projects)) {
            res.status(404).json({ error: 'Document not found or access denied.' });
            return;
        }
        const { body } = req.body;
        if (!body || typeof body !== 'string' || !body.trim()) {
            res.status(400).json({ error: 'Comment text is required.' });
            return;
        }
        const cleanBody = body.trim().slice(0, 4000);
        const mentions = db.users
            .filter((u) => cleanBody.toLowerCase().includes(`@${u.displayName.toLowerCase().split(' ')[0]}`))
            .map((u) => u.id);
        const comment = {
            id: `cmt-${crypto.randomBytes(4).toString('hex')}`,
            resourceType: 'document',
            resourceId: doc.id,
            authorId: actor.id,
            body: cleanBody,
            mentions,
            reactions: {},
            createdAt: new Date().toISOString(),
        };
        db.comments.push(comment);
        saveDb(db);
        res.status(201).json(comment);
    });
    // --- Meetings ---
    app.post('/api/v1/meetings', requireAuth, (req, res) => {
        const actor = req.authUser;
        if (!canEditWork(actor.role)) {
            res.status(403).json({ error: 'Insufficient permissions to schedule meetings.' });
            return;
        }
        if (containsOperatorConsoleViolation(req.body)) {
            res.status(403).json({ error: 'Trust boundary violation.' });
            return;
        }
        const body = req.body;
        if (typeof body.title !== 'string' || !body.title.trim() || !isValidIsoDate(body.date)) {
            res.status(400).json({ error: 'Meeting title and valid date (YYYY-MM-DD) are required.' });
            return;
        }
        const db = getDb();
        if (body.projectId) {
            const proj = db.projects.find((p) => p.id === body.projectId);
            if (!proj || !canViewProject(actor, proj)) {
                res.status(403).json({ error: 'Target project not found or access denied.' });
                return;
            }
        }
        const meeting = {
            id: `mtg-${crypto.randomBytes(4).toString('hex')}`,
            projectId: body.projectId || null,
            title: body.title.trim().slice(0, 140),
            date: body.date,
            timeRange: typeof body.timeRange === 'string' && body.timeRange.trim() ? body.timeRange.trim().slice(0, 40) : '15:00 – 15:45 UTC',
            facilitatorId: typeof body.facilitatorId === 'string' && db.users.some((u) => u.id === body.facilitatorId)
                ? body.facilitatorId
                : actor.id,
            channelRef: typeof body.channelRef === 'string' && body.channelRef.trim() ? body.channelRef.trim().slice(0, 48) : '#ctrl-plane-dev',
            agendaSummary: typeof body.agendaSummary === 'string' ? body.agendaSummary.trim().slice(0, 500) : '',
        };
        db.meetings.unshift(meeting);
        saveDb(db);
        res.status(201).json(meeting);
    });
    // --- Attachments (Authorized Upload & Path-Confined Download) ---
    app.post('/api/v1/attachments', requireAuth, (req, res) => {
        const actor = req.authUser;
        if (!canEditWork(actor.role)) {
            res.status(403).json({ error: 'Insufficient permissions.' });
            return;
        }
        const { parentType, parentId, projectId, fileName, mediaType, contentBase64 } = req.body;
        if ((parentType !== 'work_package' && parentType !== 'document') ||
            !parentId ||
            !projectId ||
            !fileName ||
            !mediaType ||
            !contentBase64) {
            res.status(400).json({ error: 'Missing required attachment fields.' });
            return;
        }
        if (!ALLOWED_UPLOAD_MIME.has(mediaType)) {
            res.status(400).json({ error: `Unsupported media type: ${mediaType}` });
            return;
        }
        const db = getDb();
        const project = db.projects.find((p) => p.id === projectId);
        if (!project || !canViewProject(actor, project)) {
            res.status(403).json({ error: 'Access denied to target project.' });
            return;
        }
        if (parentType === 'work_package') {
            const wp = db.workPackages.find((w) => w.id === parentId && w.projectId === project.id);
            if (!wp) {
                res.status(404).json({ error: 'Referenced work package not found in project.' });
                return;
            }
        }
        else {
            const doc = db.documents.find((d) => d.id === parentId);
            if (!doc || !canViewDocument(actor, doc, db.projects)) {
                res.status(403).json({ error: 'Referenced document not found or access denied.' });
                return;
            }
        }
        const normalizedBase64 = contentBase64.replace(/\s+/g, '');
        if (!/^[A-Za-z0-9+/=]+$/.test(normalizedBase64)) {
            res.status(400).json({ error: 'Invalid base64 attachment payload.' });
            return;
        }
        const buffer = Buffer.from(normalizedBase64, 'base64');
        if (buffer.byteLength === 0) {
            res.status(400).json({ error: 'Empty attachment uploads are not permitted.' });
            return;
        }
        if (buffer.byteLength > 2 * 1024 * 1024) {
            res.status(400).json({ error: 'Attachment exceeds 2 MB limit.' });
            return;
        }
        if (mediaType === 'image/svg+xml' && !isSafeSvgContent(buffer)) {
            res.status(400).json({ error: 'Rejected SVG containing active scripting or unsafe elements.' });
            return;
        }
        const safeName = sanitizeHeaderFilename(fileName);
        const storageKey = `${crypto.randomBytes(8).toString('hex')}-${safeName}`;
        const resolvedTarget = path.resolve(ATTACHMENTS_DIR, storageKey);
        if (!resolvedTarget.startsWith(ATTACHMENTS_DIR + path.sep)) {
            res.status(400).json({ error: 'Invalid file path.' });
            return;
        }
        fs.writeFileSync(resolvedTarget, buffer);
        const checksumSha256 = crypto.createHash('sha256').update(buffer).digest('hex');
        const att = {
            id: `att-${crypto.randomBytes(4).toString('hex')}`,
            parentType,
            parentId,
            projectId,
            fileName: safeName,
            mediaType,
            sizeBytes: buffer.byteLength,
            checksumSha256,
            uploadedBy: actor.id,
            uploadedAt: new Date().toISOString(),
            storageKey,
        };
        db.attachments.push(att);
        saveDb(db);
        res.status(201).json(att);
    });
    app.get('/api/v1/attachments/:id/download', requireAuth, (req, res) => {
        const actor = req.authUser;
        const db = getDb();
        const att = db.attachments.find((a) => a.id === req.params.id);
        if (!att) {
            res.status(404).json({ error: 'Attachment not found.' });
            return;
        }
        const project = db.projects.find((p) => p.id === att.projectId);
        const docAllowed = att.parentType !== 'document' ||
            (() => {
                const doc = db.documents.find((d) => d.id === att.parentId);
                return Boolean(doc && canViewDocument(actor, doc, db.projects));
            })();
        if (!project || !canViewProject(actor, project) || !docAllowed) {
            recordAudit({
                actorId: actor.id,
                actorName: actor.displayName,
                action: 'file.download_denied',
                targetType: 'Attachment',
                targetId: att.id,
                result: 'denied',
                details: 'Denied cross-project or unauthorized attachment download.',
                correlationId: req.correlationId,
            });
            res.status(403).json({ error: 'Access denied to attachment.' });
            return;
        }
        const resolvedTarget = path.resolve(ATTACHMENTS_DIR, att.storageKey);
        if (!resolvedTarget.startsWith(ATTACHMENTS_DIR + path.sep) || !fs.existsSync(resolvedTarget)) {
            res.status(404).json({ error: 'Attachment bytes unavailable.' });
            return;
        }
        const safeDownloadName = sanitizeHeaderFilename(att.fileName);
        res.setHeader('Content-Type', att.mediaType);
        res.setHeader('Content-Disposition', `attachment; filename="${safeDownloadName}"`);
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'");
        res.sendFile(resolvedTarget);
    });
    // --- Organization, Members & Access Governance ---
    app.post('/api/v1/members/invite', requireAuth, (req, res) => {
        const actor = req.authUser;
        if (!isWorkspaceAdmin(actor.role)) {
            res.status(403).json({ error: 'Only Workspace Owners or Administrators may invite members.' });
            return;
        }
        if (containsOperatorConsoleViolation(req.body)) {
            recordAudit({
                actorId: actor.id,
                actorName: actor.displayName,
                action: 'security.operator_boundary_violation',
                targetType: 'Member',
                targetId: 'invite',
                result: 'denied',
                details: 'Blocked attempt to create a production operator console seat from Engineering Workspace.',
                correlationId: req.correlationId,
            });
            res.status(403).json({
                error: 'Trust boundary violation: Engineering Workspace cannot issue or manage the 8 Production Operator Console seats.',
            });
            return;
        }
        const { email, displayName, title, role, expiresAt } = req.body;
        if (!email ||
            typeof email !== 'string' ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
            !displayName?.trim() ||
            !role ||
            !ALLOWED_ROLES.includes(role)) {
            res.status(400).json({ error: 'Valid email, displayName, and workspace role are required.' });
            return;
        }
        if (role === 'Workspace Owner' && actor.role !== 'Workspace Owner') {
            res.status(403).json({ error: 'Only an existing Workspace Owner can invite another Workspace Owner.' });
            return;
        }
        const db = getDb();
        const slotsUsed = getActiveSlotCount(db);
        if (slotsUsed >= MAX_ACCOUNT_SLOTS) {
            res.status(409).json({
                error: `Account limit reached (${slotsUsed}/${MAX_ACCOUNT_SLOTS} slots occupied). Remove or revoke an existing account to free a slot.`,
            });
            return;
        }
        if (db.users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase())) {
            res.status(409).json({ error: 'Member email already exists in workspace.' });
            return;
        }
        const newUserId = `usr-${crypto.randomBytes(4).toString('hex')}`;
        const newUser = {
            id: newUserId,
            idpSubject: `invite|trv-${crypto.randomBytes(3).toString('hex')}`,
            authProvider: 'firebase',
            displayName: displayName.trim().slice(0, 80),
            email: email.trim().toLowerCase(),
            title: title?.trim().slice(0, 80) || 'Engineer',
            role,
            state: 'invited',
            mfaEnabled: true,
            timezone: 'UTC',
            joinedAt: new Date().toISOString(),
            expiresAt: expiresAt && !Number.isNaN(Date.parse(expiresAt)) ? expiresAt : null,
            presence: 'away',
            chatNotificationMode: 'mentions_only',
            notifyOnChannelAll: true,
            desktopAlerts: false,
            channelNotificationModes: {},
        };
        const rawToken = `trv-inv-${crypto.randomBytes(16).toString('hex')}`;
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        db.users.push(newUser);
        db.invites.push({
            id: `inv-${crypto.randomBytes(4).toString('hex')}`,
            email: newUser.email,
            displayName: newUser.displayName,
            role,
            title: newUser.title,
            tokenHash,
            invitedBy: actor.id,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            acceptedAt: null,
        });
        saveDb(db);
        recordAudit({
            actorId: actor.id,
            actorName: actor.displayName,
            action: 'member.invited',
            targetType: 'User',
            targetId: newUser.id,
            result: 'success',
            details: `Invited ${newUser.email} as ${role} (slot ${getActiveSlotCount(db)}/${MAX_ACCOUNT_SLOTS}).`,
            correlationId: req.correlationId,
        });
        res.status(201).json({ user: sanitizeUser(newUser, db), inviteToken: rawToken });
    });
    app.delete('/api/v1/members/:id', requireAuth, (req, res) => {
        const actor = req.authUser;
        if (!isWorkspaceAdmin(actor.role)) {
            res.status(403).json({ error: 'Only Workspace Owners or Administrators may remove members.' });
            return;
        }
        const db = getDb();
        const target = db.users.find((u) => u.id === req.params.id);
        if (!target) {
            res.status(404).json({ error: 'Member not found.' });
            return;
        }
        if (target.id === actor.id) {
            res.status(400).json({ error: 'Cannot remove your own active workspace account.' });
            return;
        }
        const activeOwners = db.users.filter((u) => u.role === 'Workspace Owner' && u.state === 'active');
        if (target.role === 'Workspace Owner' && (actor.role !== 'Workspace Owner' || activeOwners.length <= 1)) {
            res.status(403).json({ error: 'Cannot remove a Workspace Owner unless another active Workspace Owner exists.' });
            return;
        }
        invalidateUserSessions(target.id);
        db.users = db.users.filter((u) => u.id !== target.id);
        db.invites = db.invites.filter((i) => i.email.toLowerCase() !== target.email.toLowerCase());
        for (const proj of db.projects) {
            proj.memberIds = proj.memberIds.filter((id) => id !== target.id);
        }
        for (const team of db.teams) {
            team.memberIds = team.memberIds.filter((id) => id !== target.id);
        }
        saveDb(db);
        recordAudit({
            actorId: actor.id,
            actorName: actor.displayName,
            action: 'member.removed',
            targetType: 'User',
            targetId: target.id,
            result: 'success',
            details: `Removed ${target.email} and released account slot (${getActiveSlotCount(db)}/${MAX_ACCOUNT_SLOTS} used).`,
            correlationId: req.correlationId,
        });
        res.json({ ok: true, slotsUsed: getActiveSlotCount(db), maxSlots: MAX_ACCOUNT_SLOTS });
    });
    app.patch('/api/v1/members/:id', requireAuth, (req, res) => {
        const actor = req.authUser;
        if (!isWorkspaceAdmin(actor.role)) {
            res.status(403).json({ error: 'Only Workspace Owners or Administrators may alter member roles or state.' });
            return;
        }
        if (containsOperatorConsoleViolation(req.body)) {
            recordAudit({
                actorId: actor.id,
                actorName: actor.displayName,
                action: 'security.operator_boundary_violation',
                targetType: 'User',
                targetId: req.params.id,
                result: 'denied',
                details: 'Rejected payload attempting to grant production operator privileges.',
                correlationId: req.correlationId,
            });
            res.status(403).json({
                error: 'Prohibited: Workspace administrators cannot grant Production Operator Console privileges.',
            });
            return;
        }
        const db = getDb();
        const target = db.users.find((u) => u.id === req.params.id);
        if (!target) {
            res.status(404).json({ error: 'Member not found.' });
            return;
        }
        const { role, state, expiresAt } = req.body;
        const activeOwners = db.users.filter((u) => u.role === 'Workspace Owner' && u.state === 'active');
        if (role) {
            if (!ALLOWED_ROLES.includes(role)) {
                res.status(400).json({ error: 'Invalid workspace role.' });
                return;
            }
            if ((role === 'Workspace Owner' || target.role === 'Workspace Owner') && actor.role !== 'Workspace Owner') {
                res.status(403).json({ error: 'Only an existing Workspace Owner can alter Workspace Owner assignments.' });
                return;
            }
            if (target.role === 'Workspace Owner' && role !== 'Workspace Owner' && activeOwners.length <= 1) {
                res.status(400).json({ error: 'Cannot demote the sole active Workspace Owner.' });
                return;
            }
            const prevRole = target.role;
            target.role = role;
            invalidateUserSessions(target.id);
            recordAudit({
                actorId: actor.id,
                actorName: actor.displayName,
                action: 'member.role_changed',
                targetType: 'User',
                targetId: target.id,
                result: 'success',
                details: `Changed ${target.displayName} role from ${prevRole} to ${role}.`,
                correlationId: req.correlationId,
            });
        }
        if (state) {
            if (!ALLOWED_MEMBER_STATES.has(state)) {
                res.status(400).json({ error: 'Invalid member state.' });
                return;
            }
            if (target.id === actor.id && state !== 'active') {
                res.status(400).json({ error: 'Cannot suspend or revoke your own active session.' });
                return;
            }
            if (target.role === 'Workspace Owner' && state !== 'active' && activeOwners.length <= 1) {
                res.status(400).json({ error: 'Cannot suspend or revoke the sole active Workspace Owner.' });
                return;
            }
            const prevState = target.state;
            target.state = state;
            if (state !== 'active') {
                invalidateUserSessions(target.id);
            }
            recordAudit({
                actorId: actor.id,
                actorName: actor.displayName,
                action: `member.state_${state}`,
                targetType: 'User',
                targetId: target.id,
                result: 'success',
                details: `Changed ${target.displayName} state from ${prevState} to ${state}.`,
                correlationId: req.correlationId,
            });
            emitNotification(db, {
                recipientId: actor.id,
                category: 'access',
                title: `Member access updated: ${target.displayName}`,
                summary: `Account state set to ${state}.`,
                resourceType: 'member',
                resourceId: target.id,
                securityCritical: true,
            });
        }
        if (expiresAt !== undefined) {
            target.expiresAt = expiresAt;
        }
        saveDb(db);
        res.json(sanitizeUser(target, db));
    });
    app.post('/api/v1/members/:id/keyfile', requireAuth, (req, res) => {
        const actor = req.authUser;
        if (!isWorkspaceAdmin(actor.role)) {
            res.status(403).json({ error: 'Only Workspace Owners or Administrators may issue account key files.' });
            return;
        }
        const db = getDb();
        const target = db.users.find((u) => u.id === req.params.id);
        if (!target) {
            res.status(404).json({ error: 'Member not found.' });
            return;
        }
        if (target.role === 'Workspace Owner' && actor.role !== 'Workspace Owner') {
            res.status(403).json({ error: 'Only a Workspace Owner can issue or rotate a Workspace Owner key file.' });
            return;
        }
        const keyId = `trv-key-${crypto.randomBytes(4).toString('hex')}`;
        const secret = crypto.randomBytes(32).toString('hex');
        const issuedAt = new Date().toISOString();
        const keyData = {
            product: 'truvornex',
            keyId,
            email: target.email,
            issuedAt,
            secret,
        };
        db.userKeyfileHashes = db.userKeyfileHashes || {};
        db.userKeyfileHashes[target.id] = {
            hash: sha256Hex(secret),
            keyId,
            issuedAt,
        };
        saveDb(db);
        if (target.id !== actor.id) {
            invalidateUserSessions(target.id);
        }
        recordAudit({
            actorId: actor.id,
            actorName: actor.displayName,
            action: 'member.keyfile_issued',
            targetType: 'User',
            targetId: target.id,
            result: 'success',
            details: `Issued JSON access keyfile (${keyId}) for ${target.email}.`,
            correlationId: req.correlationId,
        });
        const emailSlug = target.email.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || target.id;
        res.json({
            filename: `${emailSlug}-key.json`,
            keyId,
            issuedAt,
            keyData,
            user: sanitizeUser(target, db),
        });
    });
    // --- Notifications ---
    app.post('/api/v1/notifications/:id/read', requireAuth, (req, res) => {
        const db = getDb();
        const user = req.authUser;
        const notif = db.notifications.find((n) => n.id === req.params.id);
        if (notif && (notif.recipientId === user.id || isWorkspaceAdmin(user.role))) {
            notif.read = true;
            saveDb(db);
        }
        res.json({ ok: true });
    });
    app.post('/api/v1/notifications/read-all', requireAuth, (req, res) => {
        const db = getDb();
        const user = req.authUser;
        for (const n of db.notifications) {
            if (n.recipientId === user.id || isWorkspaceAdmin(user.role)) {
                n.read = true;
            }
        }
        saveDb(db);
        res.json({ ok: true });
    });
    // --- Integrations & Idempotent Webhook Controls ---
    app.patch('/api/v1/integrations/:id', requireAuth, (req, res) => {
        const actor = req.authUser;
        if (!isWorkspaceAdmin(actor.role)) {
            res.status(403).json({ error: 'Only Workspace Owners or Administrators may manage integrations.' });
            return;
        }
        if (containsOperatorConsoleViolation(req.body)) {
            res.status(403).json({ error: 'Trust boundary violation.' });
            return;
        }
        const db = getDb();
        const integration = db.integrations.find((i) => i.id === req.params.id);
        if (!integration) {
            res.status(404).json({ error: 'Integration not found.' });
            return;
        }
        const { enabled, rotateSecret } = req.body;
        if (typeof enabled === 'boolean') {
            integration.enabled = enabled;
            integration.status = enabled ? 'Connected' : 'Disabled';
        }
        if (rotateSecret === true) {
            integration.secretRef = `vault://truvornex/integrations/${integration.provider}-rot-${crypto
                .randomBytes(2)
                .toString('hex')}`;
            integration.lastSyncAt = new Date().toISOString();
        }
        saveDb(db);
        recordAudit({
            actorId: actor.id,
            actorName: actor.displayName,
            action: rotateSecret ? 'integration.secret_rotated' : 'integration.state_changed',
            targetType: 'Integration',
            targetId: integration.id,
            result: 'success',
            details: `${integration.name} status=${integration.status}.`,
            correlationId: req.correlationId,
        });
        res.json(integration);
    });
    app.post('/api/v1/integrations/:id/test-webhook', requireAuth, (req, res) => {
        const actor = req.authUser;
        if (!isWorkspaceAdmin(actor.role)) {
            res.status(403).json({ error: 'Admin access required.' });
            return;
        }
        const db = getDb();
        const integration = db.integrations.find((i) => i.id === req.params.id);
        if (!integration) {
            res.status(404).json({ error: 'Integration not found.' });
            return;
        }
        const { simulateInvalidSignature, deliveryId } = req.body;
        const dId = typeof deliveryId === 'string' && deliveryId.trim()
            ? deliveryId.trim().slice(0, 64)
            : `dlv-${crypto.randomBytes(4).toString('hex')}`;
        if (simulateInvalidSignature) {
            recordAudit({
                actorId: actor.id,
                actorName: actor.displayName,
                action: 'webhook.signature_rejected',
                targetType: 'Integration',
                targetId: integration.id,
                result: 'denied',
                details: `Rejected webhook delivery ${dId} due to invalid HMAC signature.`,
                correlationId: req.correlationId,
            });
            res.status(401).json({ error: 'Invalid webhook HMAC signature rejected.', deliveryId: dId });
            return;
        }
        if (db.processedWebhooks.some((w) => w.provider === integration.provider && w.deliveryId === dId)) {
            res.json({ ok: true, idempotentDuplicate: true, deliveryId: dId, message: 'Duplicate delivery ignored idempotently.' });
            return;
        }
        db.processedWebhooks.push({
            id: `wh-${crypto.randomBytes(4).toString('hex')}`,
            provider: integration.provider,
            deliveryId: dId,
            receivedAt: new Date().toISOString(),
        });
        integration.lastSyncAt = new Date().toISOString();
        saveDb(db);
        recordAudit({
            actorId: actor.id,
            actorName: actor.displayName,
            action: 'webhook.verified_processed',
            targetType: 'Integration',
            targetId: integration.id,
            result: 'success',
            details: `Processed verified webhook delivery ${dId}.`,
            correlationId: req.correlationId,
        });
        res.json({ ok: true, idempotentDuplicate: false, deliveryId: dId, message: 'Webhook signature verified and recorded.' });
    });
    // --- Workspace Settings & Audit Export ---
    app.patch('/api/v1/workspace', requireAuth, (req, res) => {
        const actor = req.authUser;
        if (!isWorkspaceAdmin(actor.role)) {
            res.status(403).json({ error: 'Admin access required.' });
            return;
        }
        if (containsOperatorConsoleViolation(req.body)) {
            res.status(403).json({ error: 'Operator console trust boundary cannot be disabled.' });
            return;
        }
        const db = getDb();
        const { programmeTitle, defaultTimezone, notificationPrefs } = req.body;
        if (typeof programmeTitle === 'string' && programmeTitle.trim()) {
            db.workspace.programmeTitle = programmeTitle.trim().slice(0, 120);
        }
        if (typeof defaultTimezone === 'string' && defaultTimezone.trim()) {
            db.workspace.defaultTimezone = defaultTimezone.trim().slice(0, 64);
        }
        if (notificationPrefs && typeof notificationPrefs === 'object') {
            if (typeof notificationPrefs.batchLowPriority === 'boolean') {
                db.workspace.notificationPrefs.batchLowPriority = notificationPrefs.batchLowPriority;
            }
            if (typeof notificationPrefs.emailDigest === 'boolean') {
                db.workspace.notificationPrefs.emailDigest = notificationPrefs.emailDigest;
            }
            if (typeof notificationPrefs.chatDeepLinks === 'boolean') {
                db.workspace.notificationPrefs.chatDeepLinks = notificationPrefs.chatDeepLinks;
            }
        }
        saveDb(db);
        recordAudit({
            actorId: actor.id,
            actorName: actor.displayName,
            action: 'workspace.settings_updated',
            targetType: 'Workspace',
            targetId: db.workspace.id,
            result: 'success',
            details: 'Updated workspace preferences.',
            correlationId: req.correlationId,
        });
        res.json(db.workspace);
    });
    app.get('/api/v1/audit/export', requireAuth, (req, res) => {
        const actor = req.authUser;
        if (!isWorkspaceAdmin(actor.role) && actor.role !== 'Programme Manager') {
            res.status(403).json({ error: 'Only Workspace Admins or Programme Managers can export audit logs.' });
            return;
        }
        const db = getDb();
        recordAudit({
            actorId: actor.id,
            actorName: actor.displayName,
            action: 'audit.exported',
            targetType: 'AuditLog',
            targetId: db.workspace.id,
            result: 'success',
            details: `Exported ${db.auditEvents.length} audit events.`,
            correlationId: req.correlationId,
        });
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="truvornex-audit-log.json"');
        res.send(JSON.stringify(db.auditEvents, null, 2));
    });
    // --- Saved Views ---
    app.post('/api/v1/saved-views', requireAuth, (req, res) => {
        const actor = req.authUser;
        if (containsOperatorConsoleViolation(req.body)) {
            res.status(403).json({ error: 'Trust boundary violation.' });
            return;
        }
        const { name, filters } = req.body;
        if (typeof name !== 'string' || !name.trim()) {
            res.status(400).json({ error: 'View name is required.' });
            return;
        }
        const db = getDb();
        const safeFilters = {};
        if (filters && typeof filters === 'object') {
            if (Array.isArray(filters.status)) {
                safeFilters.status = filters.status.filter((s) => typeof s === 'string' && WORK_PACKAGE_STATUSES.has(s));
            }
            if (Array.isArray(filters.priority)) {
                safeFilters.priority = filters.priority.filter((p) => typeof p === 'string' && PRIORITIES.has(p));
            }
            if (typeof filters.onlyBlocked === 'boolean') {
                safeFilters.onlyBlocked = filters.onlyBlocked;
            }
        }
        const view = {
            id: `view-${crypto.randomBytes(4).toString('hex')}`,
            name: name.trim().slice(0, 60),
            ownerId: actor.id,
            scope: 'workspace',
            filters: safeFilters,
        };
        db.savedViews.push(view);
        saveDb(db);
        res.status(201).json(view);
    });
    app.delete('/api/v1/saved-views/:id', requireAuth, (req, res) => {
        const actor = req.authUser;
        const db = getDb();
        const view = db.savedViews.find((v) => v.id === req.params.id);
        if (!view) {
            res.status(404).json({ error: 'Saved view not found.' });
            return;
        }
        if (view.ownerId !== actor.id && !isWorkspaceAdmin(actor.role)) {
            res.status(403).json({ error: 'Only the view creator or an administrator can delete this saved view.' });
            return;
        }
        db.savedViews = db.savedViews.filter((v) => v.id !== req.params.id);
        saveDb(db);
        res.json({ ok: true });
    });
    // --- Vite Dev / Production Static Serving ---
    const isServerless = Boolean(process.env.VERCEL || process.env.VERCEL_ENV || process.env.AWS_LAMBDA_FUNCTION_NAME);
    if (!IS_PROD && !isServerless) {
        const viteModule = 'vite';
        const { createServer: createViteServer } = await import(/* @vite-ignore */ viteModule);
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: 'spa',
        });
        app.use(vite.middlewares);
    }
    else if (!isServerless) {
        const distDir = path.resolve(process.cwd(), 'dist');
        app.use(express.static(distDir));
        app.get('*', (_req, res) => {
            res.sendFile(path.join(distDir, 'index.html'));
        });
    }
    // Global non-leaking JSON error handler
    app.use((err, req, res, _next) => {
        const correlationId = req.correlationId;
        if (err instanceof SyntaxError && 'body' in err) {
            res.status(400).json({ error: 'Invalid JSON request body.', correlationId });
            return;
        }
        console.error('Unhandled workspace error:', err);
        res.status(500).json({ error: 'An internal server error occurred.', correlationId });
    });
    return app;
}
if (!process.env.VERCEL && !process.env.VERCEL_ENV && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
    createWorkspaceApp()
        .then((app) => {
        const server = app.listen(PORT, '0.0.0.0', () => {
            console.log(`Truvornex Engineering Workspace running on http://0.0.0.0:${PORT}`);
        });
        const shutdown = () => {
            server.close(() => {
                process.exit(0);
            });
            setTimeout(() => process.exit(0), 5000).unref();
        };
        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);
    })
        .catch((err) => {
        console.error('Failed to start Truvornex server:', err);
        process.exit(1);
    });
}
