# Truvornex Firestore Security Specification

## 1. Data Invariants
1. Workspace PII (`email`, `chatNotificationMode`, `timezone`) is isolated inside `/users/{userId}/private/{docId}` and is readable/writable ONLY by the owner (`request.auth.uid == userId`) or a verified admin.
2. Public profiles (`/users/{userId}/public/{docId}`) cannot accept shadow fields, self-assigned roles, or mismatched `uid` fields.
3. Chat messages (`/chatChannels/{channelId}/messages/{messageId}`) MUST belong to an existing parent `chatChannel`, MUST set `authorId == request.auth.uid`, MUST enforce `body.size() >= 1 && body.size() <= 4000`, and MUST bound `mentions.size() <= 8`.
4. All writes require verified email authentication (`request.auth != null && request.auth.token.email_verified == true`) and server-authoritative `request.time` timestamps.
5. `authorId`, `channelId`, and `createdAt` are immutable after creation.

## 2. The Dirty Dozen Adversarial Payloads
1. Unauthenticated read on `/users/u1/private/info` -> PERMISSION_DENIED
2. Unverified email write (`email_verified: false`) on `/chatChannels/general/messages/m1` -> PERMISSION_DENIED
3. Cross-user PII read (`/users/u2/private/info` as `u1`) -> PERMISSION_DENIED
4. Shadow field injection (`isAdmin: true` or `role: "Workspace Owner"`) on `/users/u1/public/profile` -> PERMISSION_DENIED
5. Identity spoofing (`authorId: "other-user"`) on message create -> PERMISSION_DENIED
6. Oversized document ID (`1500` chars) on `/chatChannels/{channelId}` -> PERMISSION_DENIED
7. Orphaned message creation referencing non-existent `/chatChannels/ghost` -> PERMISSION_DENIED
8. Client-forged timestamp (`createdAt` != `request.time`) -> PERMISSION_DENIED
9. Unbounded `mentions` array (`size > 8`) -> PERMISSION_DENIED
10. Cross-author message body edit (`u2` updating `body` of `u1`'s message) -> PERMISSION_DENIED
11. Immutable `authorId` or `channelId` mutation during update -> PERMISSION_DENIED
12. Unauthenticated list scraping on `/chatChannels/general/messages` -> PERMISSION_DENIED
