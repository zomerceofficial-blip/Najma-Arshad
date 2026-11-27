# 07 — Identity, Access and Security

## 1. Security boundary

This is the engineering workspace. It is not the Truvornex production operator console. Workspace administrators cannot create production operator seats, grant production infrastructure privileges, retrieve production secrets or approve production operations.

## 2. Authentication

- Use OIDC with a supported identity provider.
- Require MFA for all staff; prefer phishing-resistant passkeys/security keys for administrators and privileged roles.
- Enforce secure session cookies, CSRF protection where applicable, short-lived sessions and revocation.
- Use verified invitations; no open public registration.
- Support immediate account suspension and access revocation.

## 3. Authorization

Use role-based permissions combined with resource scope and contextual checks (RBAC + ABAC).

Suggested workspace roles:

- Workspace owner
- Workspace administrator
- Programme manager
- Project manager
- Team lead
- Contributor
- Reviewer / QA
- Read-only observer
- External collaborator

Permissions must be evaluated server-side for every request. Project membership does not imply workspace administration. Team membership does not imply access to every project. Default to deny.

## 4. Separation of duties

- Task creator cannot automatically approve their own high-impact change.
- Code author cannot be the sole reviewer for a protected merge.
- Project administration does not grant identity-provider administration.
- Workspace administration does not grant production operator access.
- Integration secrets are readable only by the integration service at runtime, not displayed to ordinary administrators.

## 5. Audit

Record authentication events, membership/role changes, invitations, project visibility changes, document access to restricted material, integration changes, exports, file access where appropriate, administrative actions and security-relevant failures. Logs must include actor, action, target, timestamp, result and correlation ID while avoiding passwords, tokens and unnecessary sensitive content.

## 6. Application security baseline

- Validate input at API boundaries.
- Encode output and protect against XSS, CSRF, SSRF, injection and insecure direct object references.
- Rate-limit authentication, search and expensive endpoints.
- Use secure file upload validation, size limits, content-type checks and malware scanning where available.
- Keep dependencies pinned and scanned; use lockfiles and controlled updates.
- Store secrets in a dedicated secret manager or deployment secret store; never in source control or client bundles.
- Encrypt traffic with TLS and encrypt storage/backups using managed keys.
- Perform threat modeling before exposing integrations or administrative functions.
- Test backup restoration and incident response.

## 7. Eight-person operator boundary

The separate production operator console has exactly eight initial authorized seats under its own identity domain and approval governance. No user, role, API, database relation or integration in this workspace may create or alter those seats. The workspace may link to approved operational documentation but must not become the operator console.
