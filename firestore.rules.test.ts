/**
 * Security Rules Specification Verification Matrix (Phase 0 TDD)
 * Validates the 12 adversarial payloads against Truvornex Firestore Rules invariants.
 */

export interface SecurityAuditCase {
  id: number;
  name: string;
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  expected: 'PERMISSION_DENIED';
  reason: string;
}

export const DIRTY_DOZEN_CASES: SecurityAuditCase[] = [
  {
    id: 1,
    name: 'Unauthenticated private PII read',
    path: '/users/usr_1/private/info',
    operation: 'get',
    expected: 'PERMISSION_DENIED',
    reason: 'Master gate rejects request.auth == null.',
  },
  {
    id: 2,
    name: 'Unverified email message write',
    path: '/chatChannels/general/messages/msg_1',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    reason: 'Requires request.auth.token.email_verified == true.',
  },
  {
    id: 3,
    name: 'Cross-user private info access',
    path: '/users/usr_2/private/info',
    operation: 'get',
    expected: 'PERMISSION_DENIED',
    reason: 'Restricted strictly to isOwner(userId) || isAdmin().',
  },
  {
    id: 4,
    name: 'Shadow privilege field on public profile',
    path: '/users/usr_1/public/profile',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    reason: 'keys().hasOnly(...) rejects unallowed role/isAdmin fields.',
  },
  {
    id: 5,
    name: 'Author ID spoofing in chat message',
    path: '/chatChannels/general/messages/msg_2',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    reason: 'isValidChatMessage enforces data.authorId == request.auth.uid.',
  },
  {
    id: 6,
    name: 'Oversized document ID poisoning',
    path: `/chatChannels/${'a'.repeat(150)}`,
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    reason: 'isValidId(channelId) bounds ID length <= 128.',
  },
  {
    id: 7,
    name: 'Orphaned message for missing channel',
    path: '/chatChannels/nonexistent_ch/messages/msg_3',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    reason: 'exists() verifies parent /chatChannels/{channelId} exists.',
  },
  {
    id: 8,
    name: 'Client-forged createdAt timestamp',
    path: '/chatChannels/general/messages/msg_4',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    reason: 'Temporal integrity requires createdAt == request.time.',
  },
  {
    id: 9,
    name: 'Unbounded mentions array DoS',
    path: '/chatChannels/general/messages/msg_5',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    reason: 'Total array guarding caps mentions.size() <= 8.',
  },
  {
    id: 10,
    name: 'Unauthorized edit of another member message body',
    path: '/chatChannels/general/messages/msg_1',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    reason: 'Only message author or admin can modify body.',
  },
  {
    id: 11,
    name: 'Immutable authorId mutation on update',
    path: '/chatChannels/general/messages/msg_1',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    reason: 'affectedKeys().hasOnly(...) forbids changing authorId/channelId/createdAt.',
  },
  {
    id: 12,
    name: 'Unauthenticated list query scraping',
    path: '/chatChannels/general/messages',
    operation: 'list',
    expected: 'PERMISSION_DENIED',
    reason: 'allow list requires verified workspace membership.',
  },
];
