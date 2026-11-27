// server.js
import express from "express";
import path3 from "path";
import fs3 from "fs";
import crypto4 from "crypto";
import dotenv from "dotenv";

// src/server/store.ts
import fs from "fs";
import path from "path";
import crypto from "crypto";

// src/types/workspace.ts
var MAX_ACCOUNT_SLOTS = 8;

// src/server/store.ts
var IS_SERVERLESS = Boolean(
  process.env.VERCEL || process.env.VERCEL_ENV || process.env.AWS_LAMBDA_FUNCTION_NAME
);
var DATA_DIR = IS_SERVERLESS ? path.join("/tmp", "truvornex-data") : path.resolve(process.cwd(), ".data");
var DB_FILE = path.join(DATA_DIR, "truvornex-db.json");
var ATTACHMENTS_DIR = path.join(DATA_DIR, "attachments");
function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(ATTACHMENTS_DIR)) {
    fs.mkdirSync(ATTACHMENTS_DIR, { recursive: true });
  }
}
function getActiveSlotCount(db) {
  return db.users.filter((u) => u.state !== "revoked").length;
}
function createInitialChatChannels() {
  return [
    {
      id: "ch-general",
      name: "general",
      topic: "Workspace announcements, release milestones, and cross-team coordination",
      projectId: null,
      isPrivate: false,
      createdBy: "usr-marcus",
      createdAt: "2026-11-01T09:00:00Z"
    },
    {
      id: "ch-ctrl",
      name: "ctrl-plane-dev",
      topic: "CTRL-102 outbox replay, RFC-014 partition quotas, and policy engine reviews",
      projectId: "proj-ctrl",
      isPrivate: false,
      createdBy: "usr-david",
      createdAt: "2026-11-02T10:00:00Z"
    },
    {
      id: "ch-edge",
      name: "edge-telemetry",
      topic: "EDGE-202 blocker triage, staging cell burst testing, and M3 readiness",
      projectId: "proj-edge",
      isPrivate: false,
      createdBy: "usr-hannah",
      createdAt: "2026-11-03T11:00:00Z"
    },
    {
      id: "ch-qa",
      name: "qa-verification",
      topic: "SPEC-022 acceptance evidence enforcement and MR verification queue",
      projectId: "proj-sdkv",
      isPrivate: false,
      createdBy: "usr-sofia",
      createdAt: "2026-11-04T09:30:00Z"
    },
    {
      id: "ch-secr",
      name: "security-governance",
      topic: "ADR-003 trust boundaries, MFA enforcement, and restricted security reviews",
      projectId: "proj-secr",
      isPrivate: true,
      createdBy: "usr-marcus",
      createdAt: "2026-11-05T08:00:00Z",
      memberIds: ["usr-marcus", "usr-sofia", "usr-priya"]
    }
  ];
}
function createInitialChatMessages() {
  return [
    {
      id: "msg-1",
      channelId: "ch-general",
      authorId: "usr-marcus",
      parentMessageId: null,
      body: "Reminder: Truvornex Engineering Workspace is capped at 8 verified account slots and strictly isolated from the Production Operator Console per ADR-003.",
      mentions: [],
      mentionAll: false,
      reactions: { "\u2705": ["usr-sofia", "usr-priya", "usr-david"] },
      pinned: true,
      edited: false,
      linkedWorkKey: "SECR-401",
      createdAt: "2026-11-24T09:00:00Z",
      updatedAt: "2026-11-24T09:00:00Z"
    },
    {
      id: "msg-2",
      channelId: "ch-general",
      authorId: "usr-priya",
      parentMessageId: null,
      body: "Weekly delivery check-in: please review M2 and M3 milestone confidence ahead of Friday ARB. @David @Hannah",
      mentions: ["usr-david", "usr-hannah"],
      mentionAll: false,
      reactions: { "\u{1F44D}": ["usr-david", "usr-hannah"] },
      pinned: false,
      edited: false,
      linkedWorkKey: null,
      createdAt: "2026-11-26T08:30:00Z",
      updatedAt: "2026-11-26T08:30:00Z"
    },
    {
      id: "msg-3",
      channelId: "ch-ctrl",
      authorId: "usr-tariq",
      parentMessageId: null,
      body: "Pushed DFS dependency cycle guard updates for #CTRL-103 (MR !439). @Sofia ready for QA pass whenever you have a slot.",
      mentions: ["usr-sofia"],
      mentionAll: false,
      reactions: { "\u{1F440}": ["usr-sofia"], "\u{1F680}": ["usr-marcus"] },
      pinned: false,
      edited: false,
      linkedWorkKey: "CTRL-103",
      createdAt: "2026-11-26T09:20:00Z",
      updatedAt: "2026-11-26T09:20:00Z"
    },
    {
      id: "msg-4",
      channelId: "ch-ctrl",
      authorId: "usr-sofia",
      parentMessageId: "msg-3",
      body: "Picked up MR !439 in the verification queue \u2014 running cycle trace assertions now.",
      mentions: ["usr-tariq"],
      mentionAll: false,
      reactions: { "\u{1F44D}": ["usr-tariq"] },
      pinned: false,
      edited: false,
      linkedWorkKey: "CTRL-103",
      createdAt: "2026-11-26T09:34:00Z",
      updatedAt: "2026-11-26T09:34:00Z"
    },
    {
      id: "msg-5",
      channelId: "ch-edge",
      authorId: "usr-hannah",
      parentMessageId: null,
      body: "Flagged #EDGE-202 as Blocked pending upstream RFC-014 partition quota sign-off. @David can we finalize the quota bounds in today\u2019s ARB?",
      mentions: ["usr-david"],
      mentionAll: false,
      reactions: { "ACK": ["usr-david"] },
      pinned: true,
      edited: false,
      linkedWorkKey: "EDGE-202",
      createdAt: "2026-11-25T10:45:00Z",
      updatedAt: "2026-11-25T10:45:00Z"
    },
    {
      id: "msg-6",
      channelId: "ch-qa",
      authorId: "usr-sofia",
      parentMessageId: null,
      body: "SPEC-022 gate check is live: high-risk items require independent reviewer sign-off before transitioning to Accepted (#SDKV-301).",
      mentions: [],
      mentionAll: false,
      reactions: { "\u2705": ["usr-marcus", "usr-tariq"] },
      pinned: true,
      edited: false,
      linkedWorkKey: "SDKV-301",
      createdAt: "2026-11-26T08:15:00Z",
      updatedAt: "2026-11-26T08:15:00Z"
    },
    {
      id: "msg-7",
      channelId: "ch-secr",
      authorId: "usr-marcus",
      parentMessageId: null,
      body: "Firebase Auth + Firestore security rules verified and deployed for #SECR-401. Cross-project attachment downloads remain gated server-side.",
      mentions: ["usr-sofia"],
      mentionAll: false,
      reactions: { "\u2705": ["usr-sofia"] },
      pinned: true,
      edited: false,
      linkedWorkKey: "SECR-401",
      createdAt: "2026-11-26T10:05:00Z",
      updatedAt: "2026-11-26T10:05:00Z"
    }
  ];
}
function createSeedDatabase() {
  const users = [
    {
      id: "usr-marcus",
      idpSubject: "oidc|trv-002",
      authProvider: "firebase",
      displayName: "Marcus Chen",
      email: "marcus.chen@truvornex.internal",
      title: "Principal Systems Architect",
      role: "Workspace Administrator",
      state: "active",
      mfaEnabled: true,
      timezone: "America/Los_Angeles",
      joinedAt: "2026-01-14T10:30:00Z",
      lastActiveAt: "2026-11-27T09:00:00Z",
      presence: "active",
      chatNotificationMode: "mentions_only",
      notifyOnChannelAll: true,
      desktopAlerts: false,
      channelNotificationModes: {}
    },
    {
      id: "usr-priya",
      idpSubject: "oidc|trv-003",
      authProvider: "firebase",
      displayName: "Priya Nair",
      email: "priya.nair@truvornex.internal",
      title: "Programme Director",
      role: "Programme Manager",
      state: "active",
      mfaEnabled: true,
      timezone: "Europe/London",
      joinedAt: "2026-01-20T08:15:00Z",
      lastActiveAt: "2026-11-27T08:45:00Z",
      presence: "active",
      chatNotificationMode: "mentions_only",
      notifyOnChannelAll: true,
      desktopAlerts: false,
      channelNotificationModes: {}
    },
    {
      id: "usr-david",
      idpSubject: "oidc|trv-004",
      authProvider: "supabase",
      displayName: "David Okafor",
      email: "david.okafor@truvornex.internal",
      title: "Control Plane PM",
      role: "Project Manager",
      state: "active",
      mfaEnabled: true,
      timezone: "UTC",
      joinedAt: "2026-02-02T11:00:00Z",
      lastActiveAt: "2026-11-27T08:30:00Z",
      presence: "focus",
      chatNotificationMode: "all_messages",
      notifyOnChannelAll: true,
      desktopAlerts: false,
      channelNotificationModes: {}
    },
    {
      id: "usr-hannah",
      idpSubject: "oidc|trv-005",
      authProvider: "firebase",
      displayName: "Hannah Lindqvist",
      email: "hannah.lindqvist@truvornex.internal",
      title: "Ingestion Team Lead",
      role: "Team Lead",
      state: "active",
      mfaEnabled: true,
      timezone: "Europe/Stockholm",
      joinedAt: "2026-02-11T09:45:00Z",
      lastActiveAt: "2026-11-27T08:10:00Z",
      presence: "active",
      chatNotificationMode: "mentions_only",
      notifyOnChannelAll: true,
      desktopAlerts: false,
      channelNotificationModes: {}
    },
    {
      id: "usr-tariq",
      idpSubject: "oidc|trv-006",
      authProvider: "supabase",
      displayName: "Tariq Al-Mansoor",
      email: "tariq.mansoor@truvornex.internal",
      title: "Senior Platform Engineer",
      role: "Contributor",
      state: "active",
      mfaEnabled: true,
      timezone: "UTC",
      joinedAt: "2026-03-04T14:20:00Z",
      lastActiveAt: "2026-11-27T07:55:00Z",
      presence: "focus",
      chatNotificationMode: "mentions_only",
      notifyOnChannelAll: true,
      desktopAlerts: false,
      channelNotificationModes: {}
    },
    {
      id: "usr-sofia",
      idpSubject: "oidc|trv-007",
      authProvider: "firebase",
      displayName: "Sofia Alvarez",
      email: "sofia.alvarez@truvornex.internal",
      title: "Verification & QA Lead",
      role: "Reviewer / QA",
      state: "active",
      mfaEnabled: true,
      timezone: "America/New_York",
      joinedAt: "2026-03-18T13:00:00Z",
      lastActiveAt: "2026-11-27T09:10:00Z",
      presence: "reviewing",
      chatNotificationMode: "mentions_only",
      notifyOnChannelAll: true,
      desktopAlerts: false,
      channelNotificationModes: {}
    }
  ];
  const divisions = [
    {
      id: "div-platform",
      name: "Platform & Control Plane",
      description: "Core workspace coordination, policy engine, API gateway and state orchestration.",
      leadId: "usr-marcus"
    },
    {
      id: "div-edge",
      name: "Data, Edge & Telemetry",
      description: "Regional telemetry ingestion, stream normalization and schema validation.",
      leadId: "usr-hannah"
    },
    {
      id: "div-quality",
      name: "Quality, Security & Architecture",
      description: "Verification harnesses, threat modeling, identity standards and technical documentation.",
      leadId: "usr-sofia"
    }
  ];
  const teams = [
    {
      id: "team-ctrl",
      divisionId: "div-platform",
      name: "Control Plane Core",
      leadId: "usr-david",
      memberIds: ["usr-marcus", "usr-david", "usr-tariq"]
    },
    {
      id: "team-edge",
      divisionId: "div-edge",
      name: "Ingestion & Routing",
      leadId: "usr-hannah",
      memberIds: ["usr-hannah", "usr-tariq", "usr-priya"]
    },
    {
      id: "team-verify",
      divisionId: "div-quality",
      name: "Verification & Security",
      leadId: "usr-sofia",
      memberIds: ["usr-sofia", "usr-marcus", "usr-david"]
    },
    {
      id: "team-docs",
      divisionId: "div-quality",
      name: "Documentation & Standards",
      leadId: "usr-priya",
      memberIds: ["usr-priya", "usr-sofia", "usr-marcus"]
    }
  ];
  const projects = [
    {
      id: "proj-ctrl",
      key: "CTRL",
      name: "Control Plane & Policy Engine",
      programme: "Truvornex Core v1",
      objective: "Deliver deterministic policy evaluation, canonical work state, and idempotent event outbox for internal engineering teams.",
      ownerId: "usr-david",
      sponsorId: "usr-priya",
      status: "Active",
      health: "on_track",
      healthNote: "Schema freeze achieved ahead of M2; outbox throughput benchmark meets target latency.",
      visibility: "internal",
      startDate: "2026-10-01",
      targetDate: "2027-01-31",
      participatingTeamIds: ["team-ctrl", "team-verify"],
      memberIds: ["usr-marcus", "usr-priya", "usr-david", "usr-tariq", "usr-sofia"],
      linkedDocIds: ["doc-adr-001", "doc-adr-002", "doc-rfc-014"]
    },
    {
      id: "proj-edge",
      key: "EDGE",
      name: "Regional Edge Telemetry & Ingestion",
      programme: "Truvornex Core v1",
      objective: "Build deterministic event ingestion pipelines and schema conformance adapters across staging cells.",
      ownerId: "usr-hannah",
      sponsorId: "usr-priya",
      status: "Active",
      health: "at_risk",
      healthNote: "Backpressure retry policy blocked pending upstream schema contract sign-off (EDGE-202).",
      visibility: "internal",
      startDate: "2026-10-15",
      targetDate: "2027-02-15",
      participatingTeamIds: ["team-edge", "team-ctrl"],
      memberIds: ["usr-marcus", "usr-priya", "usr-hannah", "usr-tariq", "usr-sofia"],
      linkedDocIds: ["doc-spec-022"]
    },
    {
      id: "proj-sdkv",
      key: "SDKV",
      name: "SDK & Verification Harness",
      programme: "Developer Ecosystem",
      objective: "Provide automated contract test suites, reproducible acceptance harnesses, and client SDK bindings.",
      ownerId: "usr-sofia",
      sponsorId: "usr-marcus",
      status: "Active",
      health: "on_track",
      healthNote: "Partner verification runner passing 94% of baseline contract assertions.",
      visibility: "internal",
      startDate: "2026-10-20",
      targetDate: "2027-01-20",
      participatingTeamIds: ["team-verify", "team-docs"],
      memberIds: ["usr-marcus", "usr-sofia", "usr-priya", "usr-david", "usr-tariq"],
      linkedDocIds: ["doc-spec-022"]
    },
    {
      id: "proj-secr",
      key: "SECR",
      name: "Identity Hardening & Key Custody",
      programme: "Security & Governance",
      objective: "Enforce strict Firebase/Supabase Auth verification, separation of duties, and workspace-to-operator trust domain isolation.",
      ownerId: "usr-marcus",
      sponsorId: "usr-priya",
      status: "Active",
      health: "on_track",
      healthNote: "Restricted project scope active. Operator console separation audit passed Stage 1.",
      visibility: "restricted",
      startDate: "2026-11-01",
      targetDate: "2027-01-15",
      participatingTeamIds: ["team-verify"],
      memberIds: ["usr-marcus", "usr-sofia", "usr-priya"],
      linkedDocIds: ["doc-adr-003"]
    }
  ];
  const milestones = [
    {
      id: "ms-ctrl-1",
      projectId: "proj-ctrl",
      title: "M1 \xB7 Policy Schema Freeze",
      targetWindow: "Nov 2026",
      targetDate: "2026-11-18",
      state: "Achieved",
      confidence: 100,
      ownerId: "usr-david",
      description: "Lock canonical JSON schema and RBAC evaluation rules for Control Plane v1."
    },
    {
      id: "ms-ctrl-2",
      projectId: "proj-ctrl",
      title: "M2 \xB7 Outbox & Replay Alpha",
      targetWindow: "Dec 2026",
      targetDate: "2026-12-12",
      state: "Planned",
      confidence: 84,
      ownerId: "usr-tariq",
      description: "Complete idempotent event outbox and deterministic webhook replay verification."
    },
    {
      id: "ms-edge-1",
      projectId: "proj-edge",
      title: "M3 \xB7 Ingestion Backpressure Gate",
      targetWindow: "Dec 2026",
      targetDate: "2026-12-05",
      state: "At Risk",
      confidence: 58,
      ownerId: "usr-hannah",
      description: "Verify dead-letter bounds under 5x burst load in staging."
    },
    {
      id: "ms-sdkv-1",
      projectId: "proj-sdkv",
      title: "M4 \xB7 Verification Gate v1",
      targetWindow: "Dec 2026",
      targetDate: "2026-12-18",
      state: "Planned",
      confidence: 90,
      ownerId: "usr-sofia",
      description: "Acceptance evidence checklist automated in CI pipeline."
    },
    {
      id: "ms-secr-1",
      projectId: "proj-secr",
      title: "M5 \xB7 Trust Domain Isolation Sign-Off",
      targetWindow: "Dec 2026",
      targetDate: "2026-12-09",
      state: "Planned",
      confidence: 92,
      ownerId: "usr-marcus",
      description: "Confirm zero shared credentials between Engineering Workspace and 8-seat Operator Console."
    }
  ];
  const workPackages = [
    {
      id: "wp-101",
      key: "CTRL-101",
      projectId: "proj-ctrl",
      type: "epic",
      title: "Deterministic Policy Engine & RBAC Evaluator",
      description: "Implement server-side RBAC + ABAC policy evaluation across workspace, project, and document scopes.",
      status: "Accepted",
      priority: "Critical",
      ownerId: "usr-david",
      assigneeIds: ["usr-tariq", "usr-marcus"],
      reviewerId: "usr-sofia",
      creatorId: "usr-marcus",
      teamId: "team-ctrl",
      milestoneId: "ms-ctrl-1",
      startDate: "2026-11-01",
      dueDate: "2026-11-18",
      estimateHours: 40,
      labels: ["security", "core-api"],
      acceptanceCriteria: "100% of API routes deny unauthenticated callers; restricted project membership enforced on every GET/POST/PATCH.",
      dependenciesConfirmedNone: true,
      evidenceNote: "MR !412 merged; 48 policy matrix unit tests passing in CI run #8812.",
      highRisk: true,
      securityApprovedBy: "usr-sofia",
      version: 4,
      createdAt: "2026-10-28T09:00:00Z",
      updatedAt: "2026-11-18T17:20:00Z",
      history: [
        {
          id: "hist-1",
          field: "status",
          oldValue: "Verification",
          newValue: "Accepted",
          actorId: "usr-sofia",
          timestamp: "2026-11-18T17:20:00Z"
        }
      ]
    },
    {
      id: "wp-102",
      key: "CTRL-102",
      projectId: "proj-ctrl",
      parentId: "wp-101",
      type: "feature",
      title: "Transactional Outbox & Webhook Replay Controls",
      description: "Persist domain events atomically alongside state mutations and support idempotent webhook replay.",
      status: "In Progress",
      priority: "High",
      ownerId: "usr-tariq",
      assigneeIds: ["usr-tariq"],
      reviewerId: "usr-marcus",
      creatorId: "usr-david",
      teamId: "team-ctrl",
      milestoneId: "ms-ctrl-2",
      startDate: "2026-11-16",
      dueDate: "2026-12-06",
      estimateHours: 28,
      labels: ["outbox", "integrations"],
      acceptanceCriteria: "Duplicate deliveryId webhooks return 200 idempotent no-op; invalid HMAC signatures return 401 and create audit event.",
      dependenciesConfirmedNone: false,
      evidenceNote: "Branch feat/ctrl-102-outbox-replay active with unit tests.",
      version: 3,
      createdAt: "2026-11-10T11:00:00Z",
      updatedAt: "2026-11-25T15:10:00Z",
      history: []
    },
    {
      id: "wp-103",
      key: "CTRL-103",
      projectId: "proj-ctrl",
      type: "task",
      title: "Graph Cycle Guard for WorkPackage Dependencies",
      description: "Validate directed predecessor-successor edges prior to insert so dependency cycles cannot corrupt Gantt planning.",
      status: "In Review",
      priority: "High",
      ownerId: "usr-marcus",
      assigneeIds: ["usr-tariq"],
      reviewerId: "usr-sofia",
      creatorId: "usr-david",
      teamId: "team-ctrl",
      milestoneId: "ms-ctrl-2",
      startDate: "2026-11-19",
      dueDate: "2026-11-29",
      estimateHours: 12,
      labels: ["planning", "integrity"],
      acceptanceCriteria: "Self-edges and transitive cycles A->B->C->A return HTTP 400 with cycle trace.",
      dependenciesConfirmedNone: true,
      evidenceNote: "MR !439 ready for QA review with cycle traversal tests.",
      version: 2,
      createdAt: "2026-11-18T10:00:00Z",
      updatedAt: "2026-11-26T09:15:00Z",
      history: []
    },
    {
      id: "wp-104",
      key: "CTRL-104",
      projectId: "proj-ctrl",
      type: "task",
      title: "Saved Views & CSV Audit Export Filter Allowlist",
      description: "Allow engineering leads to save filtered work queues and export sanitized audit logs.",
      status: "Ready",
      priority: "Medium",
      ownerId: "usr-david",
      assigneeIds: ["usr-david"],
      reviewerId: "usr-sofia",
      creatorId: "usr-priya",
      teamId: "team-ctrl",
      milestoneId: "ms-ctrl-2",
      startDate: "2026-11-27",
      dueDate: "2026-12-10",
      estimateHours: 16,
      labels: ["reporting", "audit"],
      acceptanceCriteria: "Export strips secret tokens, includes correlationId, and logs export action to AuditEvent.",
      dependenciesConfirmedNone: true,
      version: 1,
      createdAt: "2026-11-20T14:00:00Z",
      updatedAt: "2026-11-24T11:30:00Z",
      history: []
    },
    {
      id: "wp-105",
      key: "CTRL-105",
      projectId: "proj-ctrl",
      type: "tech_debt",
      title: "Consolidate Optimistic Concurrency ETag Headers",
      description: "Enforce version match on concurrent document and work package edits.",
      status: "Backlog",
      priority: "Low",
      ownerId: "usr-tariq",
      assigneeIds: [],
      reviewerId: "usr-marcus",
      creatorId: "usr-marcus",
      teamId: "team-ctrl",
      milestoneId: "ms-ctrl-2",
      startDate: "2026-12-02",
      dueDate: "2026-12-14",
      estimateHours: 8,
      labels: ["tech-debt"],
      acceptanceCriteria: "Stale version writes return HTTP 409 Conflict with current server revision.",
      dependenciesConfirmedNone: true,
      version: 1,
      createdAt: "2026-11-21T08:00:00Z",
      updatedAt: "2026-11-21T08:00:00Z",
      history: []
    },
    {
      id: "wp-201",
      key: "EDGE-201",
      projectId: "proj-edge",
      type: "epic",
      title: "Regional Frame Normalization & Envelope Validator",
      description: "Normalize incoming edge telemetry envelopes and reject malformed payloads at ingress.",
      status: "Verification",
      priority: "Critical",
      ownerId: "usr-hannah",
      assigneeIds: ["usr-hannah", "usr-tariq"],
      reviewerId: "usr-sofia",
      creatorId: "usr-hannah",
      teamId: "team-edge",
      milestoneId: "ms-edge-1",
      startDate: "2026-11-05",
      dueDate: "2026-11-28",
      estimateHours: 36,
      labels: ["telemetry", "schema"],
      acceptanceCriteria: "Zero silent schema drops; invalid packets routed to quarantined DLQ with structured error code.",
      dependenciesConfirmedNone: true,
      evidenceNote: "Staging replay passed 1.2M frames; awaiting final QA latency report.",
      version: 3,
      createdAt: "2026-11-02T09:00:00Z",
      updatedAt: "2026-11-25T18:00:00Z",
      history: []
    },
    {
      id: "wp-202",
      key: "EDGE-202",
      projectId: "proj-edge",
      type: "bug",
      title: "Dead-Letter Queue Burst Backpressure Stall",
      description: "When staging cells burst above 5x baseline, consumer retry jitter collapses to 0ms and saturates connections.",
      status: "Blocked",
      priority: "Critical",
      ownerId: "usr-hannah",
      assigneeIds: ["usr-hannah"],
      reviewerId: "usr-marcus",
      creatorId: "usr-sofia",
      teamId: "team-edge",
      milestoneId: "ms-edge-1",
      startDate: "2026-11-18",
      dueDate: "2026-11-24",
      estimateHours: 14,
      labels: ["reliability", "incident-prevention"],
      acceptanceCriteria: "Exponential backoff with full jitter maintains < 2% error budget under 5x synthetic burst.",
      dependenciesConfirmedNone: false,
      blockerReason: "Awaiting upstream RFC-014 partition key quota sign-off from Control Plane Core.",
      blockerOwnerId: "usr-david",
      nextReviewDate: "2026-11-27",
      version: 5,
      createdAt: "2026-11-17T12:00:00Z",
      updatedAt: "2026-11-25T10:40:00Z",
      history: []
    },
    {
      id: "wp-203",
      key: "EDGE-203",
      projectId: "proj-edge",
      type: "task",
      title: "Staging Cell Throughput Benchmark Suite",
      description: "Automated load driver reproducing regional telemetry burst profiles.",
      status: "Ready",
      priority: "High",
      ownerId: "usr-tariq",
      assigneeIds: ["usr-tariq"],
      reviewerId: "usr-sofia",
      creatorId: "usr-hannah",
      teamId: "team-edge",
      milestoneId: "ms-edge-1",
      startDate: "2026-11-27",
      dueDate: "2026-12-05",
      estimateHours: 20,
      labels: ["benchmark", "qa"],
      acceptanceCriteria: "Publishes p50/p95/p99 latency artifact attached to milestone M3.",
      dependenciesConfirmedNone: false,
      version: 1,
      createdAt: "2026-11-19T14:30:00Z",
      updatedAt: "2026-11-24T16:00:00Z",
      history: []
    },
    {
      id: "wp-204",
      key: "EDGE-204",
      projectId: "proj-edge",
      type: "research",
      title: "Evaluate Compaction Window for Historical Snapshots",
      description: "Compare 15-minute vs 60-minute compaction buckets for analytical reporting queries.",
      status: "Backlog",
      priority: "Medium",
      ownerId: "usr-hannah",
      assigneeIds: [],
      reviewerId: "usr-marcus",
      creatorId: "usr-priya",
      teamId: "team-edge",
      milestoneId: "ms-edge-1",
      startDate: "2026-12-01",
      dueDate: "2026-12-18",
      estimateHours: 10,
      labels: ["research"],
      acceptanceCriteria: "Written ADR recommendation with storage/query trade-off matrix.",
      dependenciesConfirmedNone: true,
      version: 1,
      createdAt: "2026-11-22T09:00:00Z",
      updatedAt: "2026-11-22T09:00:00Z",
      history: []
    },
    {
      id: "wp-301",
      key: "SDKV-301",
      projectId: "proj-sdkv",
      type: "feature",
      title: "Acceptance Evidence Verification Runner CLI",
      description: "Verify every candidate release links signed test reports, docs, and reviewer sign-off.",
      status: "In Progress",
      priority: "High",
      ownerId: "usr-sofia",
      assigneeIds: ["usr-sofia", "usr-tariq"],
      reviewerId: "usr-marcus",
      creatorId: "usr-sofia",
      teamId: "team-verify",
      milestoneId: "ms-sdkv-1",
      startDate: "2026-11-12",
      dueDate: "2026-12-03",
      estimateHours: 24,
      labels: ["verification", "ci"],
      acceptanceCriteria: "CLI exits non-zero if any Accepted work package lacks reviewer evidence.",
      dependenciesConfirmedNone: true,
      evidenceNote: "Draft pipeline integrated on truvornex/verification-sdk MR !94.",
      version: 2,
      createdAt: "2026-11-11T10:00:00Z",
      updatedAt: "2026-11-26T08:00:00Z",
      history: []
    },
    {
      id: "wp-302",
      key: "SDKV-302",
      projectId: "proj-sdkv",
      parentId: "wp-301",
      type: "subtask",
      title: "External Partner Contract Test Fixtures",
      description: "Sanitized synthetic fixtures allowing external QA collaborators to validate SDK serialization.",
      status: "In Review",
      priority: "Medium",
      ownerId: "usr-sofia",
      assigneeIds: ["usr-sofia"],
      reviewerId: "usr-marcus",
      creatorId: "usr-sofia",
      teamId: "team-verify",
      milestoneId: "ms-sdkv-1",
      startDate: "2026-11-18",
      dueDate: "2026-11-29",
      estimateHours: 12,
      labels: ["fixtures", "partner"],
      acceptanceCriteria: "Fixtures contain zero production identifiers or real customer emails.",
      dependenciesConfirmedNone: true,
      evidenceNote: "MR !97 fixture scan clean.",
      version: 2,
      createdAt: "2026-11-18T11:00:00Z",
      updatedAt: "2026-11-25T16:45:00Z",
      history: []
    },
    {
      id: "wp-303",
      key: "SDKV-303",
      projectId: "proj-sdkv",
      type: "task",
      title: "Publish OpenAPI v1 Contract Bundle & Changelog",
      description: "Generate typed SDK documentation from canonical /api/v1 OpenAPI specification.",
      status: "Draft",
      priority: "Low",
      ownerId: "usr-priya",
      assigneeIds: ["usr-priya"],
      reviewerId: "usr-david",
      creatorId: "usr-priya",
      teamId: "team-docs",
      milestoneId: "ms-sdkv-1",
      startDate: "2026-12-03",
      dueDate: "2026-12-16",
      estimateHours: 8,
      labels: ["docs", "openapi"],
      acceptanceCriteria: "",
      dependenciesConfirmedNone: true,
      version: 1,
      createdAt: "2026-11-24T13:00:00Z",
      updatedAt: "2026-11-24T13:00:00Z",
      history: []
    },
    {
      id: "wp-401",
      key: "SECR-401",
      projectId: "proj-secr",
      type: "initiative",
      title: "Operator Console Trust Boundary Enforcement",
      description: "Guarantee the 8-seat production Operator Console remains strictly isolated from Engineering Workspace identities, roles, and APIs.",
      status: "In Progress",
      priority: "Critical",
      ownerId: "usr-marcus",
      assigneeIds: ["usr-marcus", "usr-sofia"],
      reviewerId: "usr-priya",
      creatorId: "usr-marcus",
      teamId: "team-verify",
      milestoneId: "ms-secr-1",
      startDate: "2026-11-04",
      dueDate: "2026-12-08",
      estimateHours: 32,
      labels: ["trust-boundary", "mandatory"],
      acceptanceCriteria: "API rejects any attempt to provision production operator seats with 403 + AuditEvent.",
      dependenciesConfirmedNone: true,
      highRisk: true,
      evidenceNote: "Guardrail route tests green on security/isolation branch.",
      version: 3,
      createdAt: "2026-11-03T09:00:00Z",
      updatedAt: "2026-11-26T09:50:00Z",
      history: []
    },
    {
      id: "wp-402",
      key: "SECR-402",
      projectId: "proj-secr",
      type: "task",
      title: "Authorized Attachment Download Gate & Checksum Verify",
      description: "Prevent unauthenticated or cross-project attachment URL guessing by enforcing project membership on every download.",
      status: "Closed",
      priority: "High",
      ownerId: "usr-marcus",
      assigneeIds: ["usr-marcus"],
      reviewerId: "usr-sofia",
      creatorId: "usr-marcus",
      teamId: "team-verify",
      milestoneId: "ms-secr-1",
      startDate: "2026-11-06",
      dueDate: "2026-11-20",
      estimateHours: 14,
      labels: ["files", "security"],
      acceptanceCriteria: "Cross-project download attempts return 403 Forbidden and emit AuditEvent.",
      dependenciesConfirmedNone: true,
      highRisk: true,
      securityApprovedBy: "usr-sofia",
      evidenceNote: "Verified by QA penetration check; SHA-256 checksum recorded.",
      version: 4,
      createdAt: "2026-11-05T10:00:00Z",
      updatedAt: "2026-11-20T18:10:00Z",
      history: []
    }
  ];
  const dependencies = [
    { id: "dep-1", predecessorId: "wp-101", successorId: "wp-102", type: "blocks" },
    { id: "dep-2", predecessorId: "wp-201", successorId: "wp-203", type: "blocks" },
    { id: "dep-3", predecessorId: "wp-202", successorId: "wp-203", type: "blocks" },
    { id: "dep-4", predecessorId: "wp-102", successorId: "wp-301", type: "relates_to" }
  ];
  const comments = [
    {
      id: "cmt-1",
      resourceType: "work_package",
      resourceId: "wp-202",
      authorId: "usr-hannah",
      body: "@David Okafor can we prioritize the RFC-014 partition quota review tomorrow morning so M3 stays on track?",
      mentions: ["usr-david"],
      reactions: { "+1": ["usr-priya", "usr-tariq"] },
      createdAt: "2026-11-25T10:42:00Z"
    },
    {
      id: "cmt-2",
      resourceType: "work_package",
      resourceId: "wp-103",
      authorId: "usr-tariq",
      body: "Added DFS cycle detection with full path reporting in MR !439. Ready for @Sofia Alvarez verification.",
      mentions: ["usr-sofia"],
      reactions: { check: ["usr-sofia"] },
      createdAt: "2026-11-26T09:18:00Z"
    },
    {
      id: "cmt-3",
      resourceType: "work_package",
      resourceId: "wp-401",
      authorId: "usr-marcus",
      body: "Confirmed ADR-003 boundary rules: workspace admins are strictly blocked from creating or altering any of the 8 production operator seats.",
      mentions: [],
      reactions: {},
      createdAt: "2026-11-26T09:52:00Z"
    }
  ];
  const documents = [
    {
      id: "doc-adr-001",
      slug: "adr-001-unified-workspace",
      projectId: "proj-ctrl",
      category: "ADR",
      title: "ADR-001 \xB7 Build a Unified Workspace, Integrate Specialist Tools",
      status: "Accepted",
      ownerId: "usr-marcus",
      labels: ["architecture", "baseline"],
      version: 2,
      restricted: false,
      linkedWorkIds: ["wp-101", "wp-102"],
      updatedAt: "2026-11-12T14:00:00Z",
      body: `# ADR-001: Unified Engineering Workspace

## Context
Truvornex engineering teams need a single source of truth for projects, work packages, decisions, milestones and traceability without rebuilding commodity developer tooling.

## Decision
Build Truvornex-specific project/work management, organization directory, knowledge base, workspace chat, and reporting capabilities. Integrate established Git/CI providers (GitLab) via normalized metadata links.

## Consequences
- No custom Git hosting in MVP.
- All external links reference canonical provider IDs rather than duplicating repository blobs.`,
      versions: [
        {
          version: 1,
          body: "Initial draft proposing unified project control + GitLab integration.",
          editorId: "usr-marcus",
          summary: "Initial proposal",
          createdAt: "2026-11-01T10:00:00Z"
        },
        {
          version: 2,
          body: "Accepted baseline signed off by Architecture Review Board.",
          editorId: "usr-priya",
          summary: "Added external ID scoping clarification",
          createdAt: "2026-11-12T14:00:00Z"
        }
      ]
    },
    {
      id: "doc-adr-002",
      slug: "adr-002-modular-monolith",
      projectId: "proj-ctrl",
      category: "ADR",
      title: "ADR-002 \xB7 Modular Monolith First",
      status: "Accepted",
      ownerId: "usr-marcus",
      labels: ["architecture", "backend"],
      version: 1,
      restricted: false,
      linkedWorkIds: ["wp-101"],
      updatedAt: "2026-11-05T11:30:00Z",
      body: `# ADR-002: Modular Monolith First

## Decision
Use a single modular API with explicit bounded domain modules (identity, organization, projects, work, planning, knowledge, chat, integrations, audit) backed by transactional persistence.

## Guardrails
- Cross-module communication flows through explicit domain services and transactional outbox events.
- Split services only when measured throughput or isolation justifies operational overhead.`,
      versions: [
        {
          version: 1,
          body: "Initial modular monolith baseline.",
          editorId: "usr-marcus",
          summary: "Initial baseline",
          createdAt: "2026-11-05T11:30:00Z"
        }
      ]
    },
    {
      id: "doc-adr-003",
      slug: "adr-003-operator-console-isolation",
      projectId: "proj-secr",
      category: "ADR",
      title: "ADR-003 \xB7 Workspace and Production Operations Are Separate Trust Domains",
      status: "Accepted",
      ownerId: "usr-marcus",
      labels: ["security", "mandatory-constraint"],
      version: 3,
      restricted: true,
      linkedWorkIds: ["wp-401", "wp-402"],
      updatedAt: "2026-11-24T16:00:00Z",
      body: `# ADR-003: Mandatory Trust Domain Separation

## Constraint
The Truvornex Engineering Workspace is capped at 8 verified engineering slots and strictly separated from production infrastructure and the eight-person Production Operator Console.

## Enforced Controls
1. No workspace role, API endpoint, or integration may create, modify, or delete any of the 8 production operator seats.
2. Production secrets and regional cell controls are never stored or proxied by the workspace.
3. Access to restricted security specifications requires explicit project membership and verified Firebase or Supabase authentication.`,
      versions: [
        {
          version: 1,
          body: "Draft trust boundary specification.",
          editorId: "usr-marcus",
          summary: "Initial constraint",
          createdAt: "2026-11-03T09:00:00Z"
        },
        {
          version: 2,
          body: "Added 8-seat operator isolation rule.",
          editorId: "usr-marcus",
          summary: "Added 8-seat API prohibition",
          createdAt: "2026-11-15T12:00:00Z"
        },
        {
          version: 3,
          body: "Finalized restricted project enforcement.",
          editorId: "usr-sofia",
          summary: "Verified with QA & Security",
          createdAt: "2026-11-24T16:00:00Z"
        }
      ]
    },
    {
      id: "doc-rfc-014",
      slug: "rfc-014-outbox-webhook-replay",
      projectId: "proj-ctrl",
      category: "RFC",
      title: "RFC-014 \xB7 Idempotent Event Outbox & Webhook Replay Policy",
      status: "In Review",
      ownerId: "usr-tariq",
      labels: ["outbox", "webhooks"],
      version: 2,
      restricted: false,
      linkedWorkIds: ["wp-102", "wp-202"],
      updatedAt: "2026-11-25T14:20:00Z",
      body: `# RFC-014: Idempotent Event Outbox & Webhook Replay

## Summary
Defines bounded retry intervals, dead-letter thresholds, and partition key quotas shared between Control Plane Core and Edge Telemetry.

## Open Question
Edge Telemetry requires higher burst quota allocation before M3 benchmark sign-off (linked to EDGE-202).`,
      versions: [
        {
          version: 1,
          body: "Initial draft.",
          editorId: "usr-tariq",
          summary: "Initial RFC draft",
          createdAt: "2026-11-19T10:00:00Z"
        },
        {
          version: 2,
          body: "Updated partition key quotas.",
          editorId: "usr-tariq",
          summary: "Added Edge burst quota section",
          createdAt: "2026-11-25T14:20:00Z"
        }
      ]
    },
    {
      id: "doc-spec-022",
      slug: "spec-022-acceptance-evidence",
      projectId: "proj-sdkv",
      category: "Specification",
      title: "SPEC-022 \xB7 Verification & Acceptance Evidence Standard",
      status: "Published",
      ownerId: "usr-sofia",
      labels: ["qa", "definition-of-done"],
      version: 1,
      restricted: false,
      linkedWorkIds: ["wp-301", "wp-302"],
      updatedAt: "2026-11-21T09:15:00Z",
      body: `# SPEC-022: Verification & Acceptance Evidence Standard

## Definition of Done
No work package transitions to Accepted without:
1. Linked implementation evidence (commit, merge request, or artifact).
2. Independent reviewer verification (author cannot self-approve high-risk work).
3. Updated technical documentation or ADR reference where architecture changed.`,
      versions: [
        {
          version: 1,
          body: "Published standard.",
          editorId: "usr-sofia",
          summary: "Published baseline standard",
          createdAt: "2026-11-21T09:15:00Z"
        }
      ]
    }
  ];
  const integrations = [
    {
      id: "int-gitlab",
      provider: "gitlab",
      name: "GitLab Enterprise (Self-Managed)",
      description: "Synchronizes repository references, branches, merge requests, CI/CD pipelines, and release tags without copying repository source.",
      status: "Connected",
      enabled: true,
      secretRef: "vault://truvornex/integrations/gitlab-oauth-app",
      webhookSecretSet: true,
      lastSyncAt: "2026-11-26T10:32:00Z",
      endpointUrl: "https://git.truvornex.internal",
      scopeNote: "read_api, read_repository (metadata only)"
    },
    {
      id: "int-mattermost",
      provider: "mattermost",
      name: "Mattermost Bridge & Workspace Chat",
      description: "Bridges project channels and delivers deep-linked notifications honoring Mentions Only vs All Messages user settings.",
      status: "Connected",
      enabled: true,
      secretRef: "vault://truvornex/integrations/mattermost-bot-token",
      webhookSecretSet: true,
      lastSyncAt: "2026-11-26T10:28:00Z",
      endpointUrl: "https://chat.truvornex.internal",
      scopeNote: "channels:read, incoming_webhooks (deep links only)"
    },
    {
      id: "int-oidc",
      provider: "oidc",
      name: "Firebase & Supabase Auth Federation",
      description: "Verifies Firebase ID tokens and Supabase JWTs with strict 8-slot workspace capacity governance.",
      status: "Connected",
      enabled: true,
      secretRef: "vault://truvornex/auth/idp-federation",
      webhookSecretSet: true,
      lastSyncAt: "2026-11-26T10:05:00Z",
      endpointUrl: "https://id.truvornex.internal/realms/engineering",
      scopeNote: "firebase_id_token, supabase_jwt"
    },
    {
      id: "int-s3",
      provider: "s3",
      name: "S3-Compatible Attachment Custody",
      description: "Stores binary attachments with SHA-256 verification and authorization-checked download streaming.",
      status: "Connected",
      enabled: true,
      secretRef: "vault://truvornex/storage/s3-workspace-key",
      webhookSecretSet: false,
      lastSyncAt: "2026-11-26T09:40:00Z",
      endpointUrl: "https://s3.internal.truvornex/truvornex-workspace-files",
      scopeNote: "scoped bucket read/write"
    }
  ];
  const externalLinks = [
    {
      id: "ext-1",
      projectId: "proj-ctrl",
      provider: "gitlab",
      kind: "repository",
      externalId: "gl-repo-101",
      title: "truvornex/control-plane",
      status: "Active \xB7 main protected",
      url: "https://git.truvornex.internal/truvornex/control-plane",
      updatedAt: "2026-11-26T09:15:00Z",
      metadata: { defaultBranch: "main", openMRs: "3", ciStatus: "Passing" }
    },
    {
      id: "ext-2",
      projectId: "proj-edge",
      provider: "gitlab",
      kind: "repository",
      externalId: "gl-repo-102",
      title: "truvornex/edge-ingestor",
      status: "Active \xB7 main protected",
      url: "https://git.truvornex.internal/truvornex/edge-ingestor",
      updatedAt: "2026-11-25T18:00:00Z",
      metadata: { defaultBranch: "main", openMRs: "2", ciStatus: "Warning" }
    },
    {
      id: "ext-3",
      projectId: "proj-sdkv",
      provider: "gitlab",
      kind: "repository",
      externalId: "gl-repo-103",
      title: "truvornex/verification-sdk",
      status: "Active \xB7 main protected",
      url: "https://git.truvornex.internal/truvornex/verification-sdk",
      updatedAt: "2026-11-26T08:00:00Z",
      metadata: { defaultBranch: "main", openMRs: "2", ciStatus: "Passing" }
    },
    {
      id: "ext-4",
      workPackageId: "wp-103",
      projectId: "proj-ctrl",
      provider: "gitlab",
      kind: "merge_request",
      externalId: "gl-mr-439",
      title: "!439 \xB7 Add cycle detection graph guard for work dependencies",
      status: "Open \xB7 Checks Passing",
      url: "https://git.truvornex.internal/truvornex/control-plane/-/merge_requests/439",
      authorName: "Tariq Al-Mansoor",
      updatedAt: "2026-11-26T09:15:00Z",
      metadata: { branch: "feat/ctrl-103-cycle-guard", approvals: "1 / 2" }
    },
    {
      id: "ext-5",
      workPackageId: "wp-102",
      projectId: "proj-ctrl",
      provider: "gitlab",
      kind: "merge_request",
      externalId: "gl-mr-441",
      title: "!441 \xB7 Transactional outbox & replay idempotency store",
      status: "Draft \xB7 Pipeline Running",
      url: "https://git.truvornex.internal/truvornex/control-plane/-/merge_requests/441",
      authorName: "Tariq Al-Mansoor",
      updatedAt: "2026-11-25T15:10:00Z",
      metadata: { branch: "feat/ctrl-102-outbox-replay", approvals: "0 / 2" }
    },
    {
      id: "ext-6",
      workPackageId: "wp-302",
      projectId: "proj-sdkv",
      provider: "gitlab",
      kind: "merge_request",
      externalId: "gl-mr-97",
      title: "!97 \xB7 Sanitized partner contract test fixtures",
      status: "Open \xB7 Ready for QA",
      url: "https://git.truvornex.internal/truvornex/verification-sdk/-/merge_requests/97",
      authorName: "Sofia Alvarez",
      updatedAt: "2026-11-25T16:45:00Z",
      metadata: { branch: "feat/sdkv-302-fixtures", approvals: "1 / 1" }
    },
    {
      id: "ext-7",
      workPackageId: "wp-103",
      projectId: "proj-ctrl",
      provider: "gitlab",
      kind: "pipeline",
      externalId: "gl-pipe-9042",
      title: "Pipeline #9042 \xB7 control-plane / feat/ctrl-103-cycle-guard",
      status: "Passed (3m 42s)",
      url: "https://git.truvornex.internal/truvornex/control-plane/-/pipelines/9042",
      updatedAt: "2026-11-26T09:14:00Z",
      metadata: { tests: "184 passed", coverage: "91.4%" }
    },
    {
      id: "ext-8",
      workPackageId: "wp-202",
      projectId: "proj-edge",
      provider: "gitlab",
      kind: "pipeline",
      externalId: "gl-pipe-9019",
      title: "Pipeline #9019 \xB7 edge-ingestor / burst-stress-suite",
      status: "Failed (Backpressure timeout)",
      url: "https://git.truvornex.internal/truvornex/edge-ingestor/-/pipelines/9019",
      updatedAt: "2026-11-25T10:35:00Z",
      metadata: { tests: "41 passed, 2 failed", coverage: "84.0%" }
    },
    {
      id: "ext-9",
      projectId: "proj-ctrl",
      provider: "gitlab",
      kind: "release",
      externalId: "gl-rel-0.9.4",
      title: "v0.9.4-rc2 \xB7 Control Plane Policy Engine Baseline",
      status: "Tagged \xB7 Verified",
      url: "https://git.truvornex.internal/truvornex/control-plane/-/releases/v0.9.4-rc2",
      updatedAt: "2026-11-18T18:00:00Z",
      metadata: { commit: "a8f31c9", workPackage: "CTRL-101" }
    },
    {
      id: "ext-10",
      projectId: "proj-ctrl",
      provider: "mattermost",
      kind: "channel",
      externalId: "mm-ch-ctrl",
      title: "#ctrl-plane-dev",
      status: "Synced \xB7 5 members",
      url: "https://chat.truvornex.internal/truvornex/channels/ctrl-plane-dev",
      updatedAt: "2026-11-26T10:15:00Z",
      metadata: { topic: "CTRL-102 outbox & RFC-014 review" }
    },
    {
      id: "ext-11",
      projectId: "proj-edge",
      provider: "mattermost",
      kind: "channel",
      externalId: "mm-ch-edge",
      title: "#edge-telemetry",
      status: "Synced \xB7 5 members",
      url: "https://chat.truvornex.internal/truvornex/channels/edge-telemetry",
      updatedAt: "2026-11-26T09:50:00Z",
      metadata: { topic: "EDGE-202 blocker triage & M3 benchmark" }
    },
    {
      id: "ext-12",
      projectId: "proj-sdkv",
      provider: "mattermost",
      kind: "channel",
      externalId: "mm-ch-verify",
      title: "#qa-verification",
      status: "Synced \xB7 5 members",
      url: "https://chat.truvornex.internal/truvornex/channels/qa-verification",
      updatedAt: "2026-11-26T08:40:00Z",
      metadata: { topic: "SPEC-022 acceptance criteria enforcement" }
    }
  ];
  const notifications = [
    {
      id: "notif-1",
      recipientId: "usr-marcus",
      category: "blocker",
      title: "EDGE-202 marked Blocked (Overdue)",
      summary: "Hannah Lindqvist flagged a partition quota dependency blocking EDGE-203 and Milestone M3.",
      resourceType: "work_package",
      resourceId: "wp-202",
      securityCritical: false,
      read: false,
      createdAt: "2026-11-25T10:42:00Z"
    },
    {
      id: "notif-2",
      recipientId: "usr-marcus",
      category: "review",
      title: "Review requested on SECR-401",
      summary: "Trust-boundary guardrail evidence submitted for owner & admin review.",
      resourceType: "work_package",
      resourceId: "wp-401",
      securityCritical: true,
      read: false,
      createdAt: "2026-11-26T09:52:00Z"
    }
  ];
  const auditEvents = [
    {
      id: "aud-1",
      correlationId: "corr-9f12a8b1",
      actorId: "usr-marcus",
      actorName: "Marcus Chen",
      action: "project.visibility.updated",
      targetType: "Project",
      targetId: "SECR",
      result: "success",
      details: "Set project SECR visibility to restricted (3 explicit members).",
      timestamp: "2026-11-01T09:12:00Z"
    },
    {
      id: "aud-2",
      correlationId: "corr-7c34e210",
      actorId: "usr-sofia",
      actorName: "Sofia Alvarez",
      action: "work_package.accepted",
      targetType: "WorkPackage",
      targetId: "CTRL-101",
      result: "success",
      details: "Verified evidence MR !412 and independent security sign-off.",
      timestamp: "2026-11-18T17:20:00Z"
    },
    {
      id: "aud-3",
      correlationId: "corr-2a19d77f",
      actorId: "usr-marcus",
      actorName: "Marcus Chen",
      action: "document.updated",
      targetType: "Document",
      targetId: "doc-adr-003",
      result: "success",
      details: "Published v3 of ADR-003 enforcing 8-slot workspace cap & Operator Console isolation.",
      timestamp: "2026-11-24T16:00:00Z"
    }
  ];
  const activityEvents = [
    {
      id: "act-1",
      actorId: "usr-marcus",
      action: "updated",
      resourceType: "work_package",
      resourceId: "wp-401",
      resourceKey: "SECR-401",
      resourceTitle: "Operator Console Trust Boundary Enforcement",
      projectId: "proj-secr",
      summary: "Posted guardrail verification evidence and linked ADR-003.",
      timestamp: "2026-11-26T09:52:00Z"
    },
    {
      id: "act-2",
      actorId: "usr-tariq",
      action: "moved to In Review",
      resourceType: "work_package",
      resourceId: "wp-103",
      resourceKey: "CTRL-103",
      resourceTitle: "Graph Cycle Guard for WorkPackage Dependencies",
      projectId: "proj-ctrl",
      summary: "Submitted MR !439 and Pipeline #9042 for QA verification.",
      timestamp: "2026-11-26T09:15:00Z"
    },
    {
      id: "act-3",
      actorId: "usr-sofia",
      action: "submitted review for",
      resourceType: "work_package",
      resourceId: "wp-302",
      resourceKey: "SDKV-302",
      resourceTitle: "External Partner Contract Test Fixtures",
      projectId: "proj-sdkv",
      summary: "Attached sanitized fixtures in MR !97.",
      timestamp: "2026-11-25T16:45:00Z"
    },
    {
      id: "act-4",
      actorId: "usr-tariq",
      action: "revised",
      resourceType: "document",
      resourceId: "doc-rfc-014",
      resourceKey: "RFC-014",
      resourceTitle: "Idempotent Event Outbox & Webhook Replay Policy",
      projectId: "proj-ctrl",
      summary: "Updated partition key quota section (v2).",
      timestamp: "2026-11-25T14:20:00Z"
    },
    {
      id: "act-5",
      actorId: "usr-hannah",
      action: "flagged Blocked on",
      resourceType: "work_package",
      resourceId: "wp-202",
      resourceKey: "EDGE-202",
      resourceTitle: "Dead-Letter Queue Burst Backpressure Stall",
      projectId: "proj-edge",
      summary: "Assigned blocker owner David Okafor with review date 2026-11-27.",
      timestamp: "2026-11-25T10:40:00Z"
    }
  ];
  const meetings = [
    {
      id: "mtg-1",
      projectId: "proj-ctrl",
      title: "Architecture Review Board \xB7 RFC-014 Quota Sign-Off",
      date: "2026-11-27",
      timeRange: "14:00 \u2013 14:45 UTC",
      facilitatorId: "usr-marcus",
      channelRef: "#ctrl-plane-dev",
      agendaSummary: "Unblock EDGE-202 partition key quota and verify outbox replay bounds."
    },
    {
      id: "mtg-2",
      projectId: "proj-edge",
      title: "M3 Ingestion Benchmark Readiness Check",
      date: "2026-11-30",
      timeRange: "16:00 \u2013 16:30 UTC",
      facilitatorId: "usr-hannah",
      channelRef: "#edge-telemetry",
      agendaSummary: "Review p99 ingestion latency and DLQ error budget."
    },
    {
      id: "mtg-3",
      projectId: "proj-sdkv",
      title: "Verification Gate v1 & SPEC-022 Dry Run",
      date: "2026-12-02",
      timeRange: "15:00 \u2013 15:45 UTC",
      facilitatorId: "usr-sofia",
      channelRef: "#qa-verification",
      agendaSummary: "Validate automated acceptance evidence checks across open MRs."
    }
  ];
  const savedViews = [
    {
      id: "view-1",
      name: "Blocked & Critical Attention",
      ownerId: "usr-priya",
      scope: "workspace",
      filters: { onlyBlocked: true, priority: ["Critical", "High"] }
    },
    {
      id: "view-2",
      name: "QA Review & Verification Queue",
      ownerId: "usr-sofia",
      scope: "workspace",
      filters: { status: ["In Review", "Verification"] }
    }
  ];
  return {
    schemaVersion: 2,
    workspace: {
      id: "ws-truvornex",
      name: "Truvornex",
      programmeTitle: "Truvornex Infrastructure Programme",
      defaultTimezone: "UTC",
      enforceMfa: true,
      operatorConsoleIsolated: true,
      operatorSeatLimit: 8,
      maxAccountSlots: MAX_ACCOUNT_SLOTS,
      notificationPrefs: {
        batchLowPriority: true,
        emailDigest: true,
        chatDeepLinks: true
      }
    },
    invites: [],
    revokedJtis: [],
    sessionInvalidBefore: {},
    users,
    divisions,
    teams,
    projects,
    milestones,
    workPackages,
    dependencies,
    comments,
    documents,
    attachments: [],
    integrations,
    externalLinks,
    notifications,
    auditEvents,
    activityEvents,
    meetings,
    savedViews,
    chatChannels: createInitialChatChannels(),
    chatMessages: createInitialChatMessages(),
    processedWebhooks: [],
    masterKeyfileHash: null,
    userKeyfileHashes: {}
  };
}
function normalizeLegacyDatabase(parsed) {
  const seed = createSeedDatabase();
  if (!parsed.schemaVersion || parsed.schemaVersion < 2 || !Array.isArray(parsed.users) || parsed.users.length > MAX_ACCOUNT_SLOTS) {
    return seed;
  }
  const users = parsed.users.map((u) => ({
    ...u,
    authProvider: u.authProvider || "firebase",
    presence: u.presence || "active",
    chatNotificationMode: u.chatNotificationMode || "mentions_only",
    notifyOnChannelAll: typeof u.notifyOnChannelAll === "boolean" ? u.notifyOnChannelAll : true,
    desktopAlerts: typeof u.desktopAlerts === "boolean" ? u.desktopAlerts : false,
    channelNotificationModes: u.channelNotificationModes || {}
  }));
  return {
    ...seed,
    ...parsed,
    schemaVersion: 2,
    workspace: {
      ...seed.workspace,
      ...parsed.workspace || {},
      maxAccountSlots: MAX_ACCOUNT_SLOTS
    },
    users,
    revokedJtis: Array.isArray(parsed.revokedJtis) ? parsed.revokedJtis : [],
    sessionInvalidBefore: parsed.sessionInvalidBefore && typeof parsed.sessionInvalidBefore === "object" ? parsed.sessionInvalidBefore : {},
    chatChannels: Array.isArray(parsed.chatChannels) && parsed.chatChannels.length > 0 ? parsed.chatChannels : createInitialChatChannels(),
    chatMessages: Array.isArray(parsed.chatMessages) && parsed.chatMessages.length > 0 ? parsed.chatMessages : createInitialChatMessages(),
    masterKeyfileHash: typeof parsed.masterKeyfileHash === "string" ? parsed.masterKeyfileHash : null,
    userKeyfileHashes: parsed.userKeyfileHashes && typeof parsed.userKeyfileHashes === "object" ? parsed.userKeyfileHashes : {}
  };
}
var cachedDb = null;
function getDb() {
  if (cachedDb) return cachedDb;
  ensureDirs();
  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      cachedDb = normalizeLegacyDatabase(parsed);
      if ((parsed.schemaVersion || 0) < 2) {
        saveDb(cachedDb);
      }
      return cachedDb;
    } catch {
    }
  }
  cachedDb = createSeedDatabase();
  saveDb(cachedDb);
  return cachedDb;
}
function saveDb(db) {
  ensureDirs();
  const tmpFile = `${DB_FILE}.${crypto.randomBytes(4).toString("hex")}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), "utf-8");
  fs.renameSync(tmpFile, DB_FILE);
  cachedDb = db;
}

// src/server/security.ts
import crypto2 from "crypto";
import fs2 from "fs";
import path2 from "path";
import { getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { createClient } from "@supabase/supabase-js";
var SECRET_FILE = path2.join(DATA_DIR, ".session-secret");
var cachedSigningKey = null;
var cachedFirebaseProjectId = null;
function getFirebaseProjectId() {
  if (cachedFirebaseProjectId) return cachedFirebaseProjectId;
  const envProj = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
  if (envProj && envProj.trim()) {
    cachedFirebaseProjectId = envProj.trim();
    return cachedFirebaseProjectId;
  }
  try {
    const configPath = path2.resolve(process.cwd(), "firebase-applet-config.json");
    if (fs2.existsSync(configPath)) {
      const raw = JSON.parse(fs2.readFileSync(configPath, "utf-8"));
      if (raw.projectId) {
        cachedFirebaseProjectId = raw.projectId;
        return cachedFirebaseProjectId;
      }
    }
  } catch {
  }
  cachedFirebaseProjectId = "gen-lang-client-0293770399";
  return cachedFirebaseProjectId;
}
function getFirebaseAdminAuth() {
  const projectId = getFirebaseProjectId();
  const app = getApps().length ? getApp() : initializeApp({ projectId });
  return getAuth(app);
}
async function verifyFirebaseIdToken(idToken) {
  const auth = getFirebaseAdminAuth();
  const decoded = await auth.verifyIdToken(idToken, false);
  const email = (decoded.email || "").trim().toLowerCase();
  if (!email) {
    throw new Error("Firebase account must provide a verified email address.");
  }
  const fallbackName = email.split("@")[0].replace(/[._-]+/g, " ");
  return {
    provider: "firebase",
    subject: `firebase|${decoded.uid}`,
    email,
    displayName: typeof decoded.name === "string" && decoded.name.trim() ? decoded.name.trim().slice(0, 80) : fallbackName,
    emailVerified: Boolean(decoded.email_verified)
  };
}
function isSupabaseServerConfigured() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim();
  const key = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "").trim();
  return Boolean(url && key);
}
async function verifySupabaseAccessToken(accessToken) {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim();
  const key = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "").trim();
  if (!url || !key) {
    throw new Error("Supabase Auth is not configured on this server (set SUPABASE_URL and SUPABASE_ANON_KEY).");
  }
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) {
    throw new Error(error?.message || "Invalid or expired Supabase session token.");
  }
  const email = (data.user.email || "").trim().toLowerCase();
  if (!email) {
    throw new Error("Supabase account must provide an email address.");
  }
  const metaName = typeof data.user.user_metadata?.full_name === "string" ? data.user.user_metadata.full_name : typeof data.user.user_metadata?.name === "string" ? data.user.user_metadata.name : email.split("@")[0].replace(/[._-]+/g, " ");
  return {
    provider: "supabase",
    subject: `supabase|${data.user.id}`,
    email,
    displayName: metaName.trim().slice(0, 80) || email.split("@")[0],
    emailVerified: Boolean(data.user.email_confirmed_at || data.user.confirmed_at)
  };
}
function getSigningKey() {
  if (cachedSigningKey) return cachedSigningKey;
  const envSecret = process.env.TRUVORNEX_SESSION_SECRET || process.env.SESSION_SECRET;
  if (envSecret && envSecret.trim().length >= 32) {
    cachedSigningKey = envSecret.trim();
    return cachedSigningKey;
  }
  try {
    if (!fs2.existsSync(DATA_DIR)) fs2.mkdirSync(DATA_DIR, { recursive: true, mode: 448 });
    if (fs2.existsSync(SECRET_FILE)) {
      const stored = fs2.readFileSync(SECRET_FILE, "utf-8").trim();
      if (stored.length >= 32) {
        cachedSigningKey = stored;
        return cachedSigningKey;
      }
    }
    const generated = crypto2.randomBytes(48).toString("hex");
    fs2.writeFileSync(SECRET_FILE, generated, { encoding: "utf-8", mode: 384 });
    cachedSigningKey = generated;
    return cachedSigningKey;
  } catch {
    cachedSigningKey = crypto2.randomBytes(48).toString("hex");
    return cachedSigningKey;
  }
}
function signSessionToken(userId, ttlSeconds = 60 * 60 * 8, scope = "full") {
  const nowMs = Date.now();
  const nowSec = Math.floor(nowMs / 1e3);
  const payload = {
    uid: userId,
    jti: crypto2.randomBytes(16).toString("hex"),
    iat: nowSec,
    iatMs: nowMs,
    exp: nowSec + ttlSeconds,
    scope
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto2.createHmac("sha256", getSigningKey()).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}
function verifySessionToken(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;
  const expectedSig = crypto2.createHmac("sha256", getSigningKey()).update(encoded).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto2.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf-8"));
    const nowSec = Math.floor(Date.now() / 1e3);
    if (!payload.uid || !payload.jti || !payload.exp || payload.exp < nowSec) {
      return null;
    }
    const db = getDb();
    if (db.revokedJtis.some((r) => r.jti === payload.jti)) {
      return null;
    }
    const invalidBefore = db.sessionInvalidBefore[payload.uid];
    const issuedAtMs = typeof payload.iatMs === "number" ? payload.iatMs : (payload.iat || 0) * 1e3;
    if (typeof invalidBefore === "number" && issuedAtMs <= invalidBefore) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
function revokeSessionToken(token) {
  if (!token) return;
  const parts = token.split(".");
  if (parts.length !== 2) return;
  try {
    const payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf-8"));
    if (!payload.jti || !payload.exp) return;
    const db = getDb();
    const nowSec = Math.floor(Date.now() / 1e3);
    db.revokedJtis = db.revokedJtis.filter((r) => r.exp > nowSec);
    if (!db.revokedJtis.some((r) => r.jti === payload.jti)) {
      db.revokedJtis.push({ jti: payload.jti, exp: payload.exp });
    }
    saveDb(db);
  } catch {
  }
}
function invalidateUserSessions(userId) {
  const db = getDb();
  db.sessionInvalidBefore[userId] = Date.now();
  saveDb(db);
}
function correlationMiddleware(req, res, next) {
  const incoming = req.headers["x-correlation-id"];
  const correlationId = typeof incoming === "string" && /^[a-zA-Z0-9_-]{6,64}$/.test(incoming) ? incoming : `corr-${crypto2.randomBytes(6).toString("hex")}`;
  req.correlationId = correlationId;
  res.setHeader("X-Correlation-Id", correlationId);
  next();
}
function createRateLimiter(options) {
  const hits = /* @__PURE__ */ new Map();
  return (req, res, next) => {
    const now = Date.now();
    if (hits.size > 5e3) {
      for (const [k, v] of hits.entries()) {
        if (v.resetAt <= now) hits.delete(k);
      }
    }
    const key = options.keyFn ? options.keyFn(req) : req.ip || "unknown";
    const current = hits.get(key);
    if (!current || current.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }
    current.count += 1;
    if (current.count > options.max) {
      const retrySec = Math.max(1, Math.ceil((current.resetAt - now) / 1e3));
      res.setHeader("Retry-After", String(retrySec));
      res.status(429).json({
        error: options.message || "Too many requests. Please wait before trying again.",
        retryAfterSeconds: retrySec,
        correlationId: req.correlationId
      });
      return;
    }
    next();
  };
}
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required", correlationId: req.correlationId });
    return;
  }
  const token = authHeader.slice("Bearer ".length).trim();
  const payload = verifySessionToken(token);
  if (!payload) {
    res.status(401).json({ error: "Session expired or invalid", correlationId: req.correlationId });
    return;
  }
  if (payload.scope === "pending_keyfile") {
    res.status(403).json({ error: "Key file verification required.", correlationId: req.correlationId });
    return;
  }
  const db = getDb();
  const user = db.users.find((u) => u.id === payload.uid);
  if (!user || user.state !== "active") {
    res.status(403).json({ error: "Account is suspended or revoked", correlationId: req.correlationId });
    return;
  }
  if (user.expiresAt && new Date(user.expiresAt).getTime() <= Date.now()) {
    res.status(403).json({ error: "Time-limited collaborator access has expired", correlationId: req.correlationId });
    return;
  }
  req.authUser = user;
  req.authToken = token;
  next();
}
function sha256Hex(value) {
  return crypto2.createHash("sha256").update(value, "utf8").digest("hex");
}
function timingSafeEqualHex(a, b) {
  const normA = a.trim().toLowerCase();
  const normB = b.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normA) || !/^[a-f0-9]{64}$/.test(normB)) {
    return false;
  }
  return crypto2.timingSafeEqual(Buffer.from(normA, "hex"), Buffer.from(normB, "hex"));
}
function stableSortValue(value) {
  if (Array.isArray(value)) {
    return value.map(stableSortValue);
  }
  if (value && typeof value === "object") {
    const sorted = {};
    for (const key of Object.keys(value).sort()) {
      if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
      sorted[key] = stableSortValue(value[key]);
    }
    return sorted;
  }
  return value;
}
function stableStringify(value) {
  return JSON.stringify(stableSortValue(value));
}
function extractKeyfileDigests(keyData) {
  let parsed = keyData;
  if (typeof keyData === "string") {
    if (keyData.length > 64 * 1024) return null;
    try {
      parsed = JSON.parse(keyData);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }
  if (hasPrototypePollutionKeys(parsed)) {
    return null;
  }
  const serialized = stableStringify(parsed);
  if (!serialized || serialized.length > 64 * 1024 || serialized === "{}") {
    return null;
  }
  const record = parsed;
  const secretCandidate = typeof record.secret === "string" ? record.secret : typeof record.key === "string" ? record.key : typeof record.accessKey === "string" ? record.accessKey : typeof record.private_key === "string" ? record.private_key : typeof record.token === "string" ? record.token : null;
  const trimmedSecret = secretCandidate ? secretCandidate.trim() : "";
  return {
    canonicalDigest: sha256Hex(serialized),
    secretDigest: trimmedSecret ? sha256Hex(trimmedSecret) : null
  };
}
function isWorkspaceAdmin(role) {
  return role === "Workspace Owner" || role === "Workspace Administrator";
}
function canManageProjects(role) {
  return role === "Workspace Owner" || role === "Workspace Administrator" || role === "Programme Manager" || role === "Project Manager";
}
function canEditWork(role) {
  return role !== "Read-only Observer";
}
function canApproveWork(role) {
  return role === "Workspace Owner" || role === "Workspace Administrator" || role === "Programme Manager" || role === "Project Manager" || role === "Team Lead" || role === "Reviewer / QA";
}
function canViewProject(user, project) {
  if (isWorkspaceAdmin(user.role) || user.role === "Programme Manager") {
    if (project.visibility === "restricted") {
      return project.memberIds.includes(user.id) || user.role === "Workspace Owner";
    }
    return true;
  }
  if (user.role === "External Collaborator") {
    return project.memberIds.includes(user.id) && project.visibility !== "restricted";
  }
  if (project.visibility === "restricted") {
    return project.memberIds.includes(user.id);
  }
  return true;
}
function canViewDocument(user, doc, projects) {
  if (doc.projectId) {
    const project = projects.find((p) => p.id === doc.projectId);
    if (project && !canViewProject(user, project)) return false;
  }
  if (doc.restricted) {
    if (user.role === "Workspace Owner") return true;
    if (user.role === "External Collaborator") return false;
    if (doc.projectId) {
      const project = projects.find((p) => p.id === doc.projectId);
      return Boolean(project && project.memberIds.includes(user.id));
    }
    return isWorkspaceAdmin(user.role) || doc.ownerId === user.id;
  }
  return true;
}
function recordAudit(params) {
  const db = getDb();
  db.auditEvents.unshift({
    id: `aud-${crypto2.randomBytes(5).toString("hex")}`,
    correlationId: params.correlationId || `corr-${crypto2.randomBytes(6).toString("hex")}`,
    actorId: params.actorId,
    actorName: params.actorName,
    action: params.action,
    targetType: params.targetType,
    targetId: params.targetId,
    result: params.result,
    details: params.details,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
  if (db.auditEvents.length > 2e3) {
    db.auditEvents.length = 2e3;
  }
  saveDb(db);
}
function containsOperatorConsoleViolation(payload) {
  if (!payload || typeof payload !== "object") return false;
  const serialized = JSON.stringify(payload).toLowerCase();
  const forbiddenPatterns = [
    "production_operator",
    "operator_seat",
    "operator_console",
    "prod_operator",
    "operator_credential",
    "regional_cell_control"
  ];
  return forbiddenPatterns.some((p) => serialized.includes(p));
}
function hasPrototypePollutionKeys(obj) {
  if (!obj || typeof obj !== "object") return false;
  if (Array.isArray(obj)) return obj.some(hasPrototypePollutionKeys);
  for (const key of Object.keys(obj)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      return true;
    }
    if (hasPrototypePollutionKeys(obj[key])) {
      return true;
    }
  }
  return false;
}
function sanitizeHeaderFilename(name) {
  const base = path2.basename(name).replace(/[^a-zA-Z0-9._-]/g, "_");
  return base.replace(/^\.+/, "") || "attachment.bin";
}
function isSafeSvgContent(buffer) {
  const text = buffer.toString("utf8").toLowerCase();
  const forbidden = ["<script", "javascript:", "onload=", "onerror=", "onclick=", "onmouseover=", "<foreignobject", "<iframe", "<object", "<embed"];
  return !forbidden.some((token) => text.includes(token));
}

// src/server/domain.ts
import crypto3 from "crypto";
function detectDependencyCycle(dependencies, predecessorId, successorId) {
  if (predecessorId === successorId) {
    return [predecessorId, successorId];
  }
  const adj = /* @__PURE__ */ new Map();
  for (const dep of dependencies) {
    if (!adj.has(dep.predecessorId)) adj.set(dep.predecessorId, []);
    adj.get(dep.predecessorId).push(dep.successorId);
  }
  const visited = /* @__PURE__ */ new Set();
  const path4 = [];
  function dfs(current) {
    if (current === predecessorId) {
      path4.push(current);
      return true;
    }
    if (visited.has(current)) return false;
    visited.add(current);
    path4.push(current);
    const nexts = adj.get(current) || [];
    for (const nxt of nexts) {
      if (dfs(nxt)) return true;
    }
    path4.pop();
    return false;
  }
  if (dfs(successorId)) {
    return [predecessorId, ...path4];
  }
  return null;
}
function validateWorkPackageTransition(params) {
  const { db, actor, existing, next } = params;
  const targetStatus = next.status;
  if (targetStatus === existing.status) {
    return null;
  }
  if (targetStatus === "Ready" || targetStatus === "In Progress" || targetStatus === "In Review" || targetStatus === "Verification" || targetStatus === "Accepted") {
    if (!next.title?.trim() || !next.description?.trim()) {
      return "Title and problem statement are required before entering Ready or active execution.";
    }
    if (!next.ownerId) {
      return "An accountable owner is required.";
    }
    if (!next.acceptanceCriteria?.trim()) {
      return "Acceptance criteria are required before a task can enter Ready.";
    }
    const hasDeps = db.dependencies.some((d) => d.successorId === next.id || d.predecessorId === next.id);
    if (!hasDeps && !next.dependenciesConfirmedNone) {
      return "Record dependencies or confirm none are known before entering Ready.";
    }
    if (targetStatus === "Ready" || targetStatus === "In Progress") {
      const blockingDeps = db.dependencies.filter(
        (d) => d.successorId === next.id && d.type === "blocks"
      );
      const unresolvedBlockers = blockingDeps.map((d) => db.workPackages.find((wp) => wp.id === d.predecessorId)).filter((wp) => Boolean(wp && wp.status !== "Accepted" && wp.status !== "Closed"));
      if (unresolvedBlockers.length > 0 && !next.blockerExceptionReason?.trim()) {
        return `Blocked by unresolved predecessor(s): ${unresolvedBlockers.map((b) => b.key).join(", ")}. Resolve predecessor or record an authorized exception.`;
      }
    }
  }
  if (targetStatus === "Blocked") {
    if (!next.blockerReason?.trim() || !next.blockerOwnerId || !next.nextReviewDate?.trim()) {
      return "Blocked work requires a reason, a blocker owner, and a next review date.";
    }
  }
  if (targetStatus === "In Review") {
    const hasLink = db.externalLinks.some((l) => l.workPackageId === next.id);
    if (!next.evidenceNote?.trim() && !hasLink) {
      return "Moving to In Review requires implementation evidence (evidence note or linked merge request/branch).";
    }
  }
  if (targetStatus === "Accepted" || targetStatus === "Closed") {
    if (!canApproveWork(actor.role)) {
      return "Only a Reviewer/QA, Team Lead, Project Manager, or Workspace Admin may accept or close work.";
    }
    const hasLink = db.externalLinks.some((l) => l.workPackageId === next.id);
    if (!next.evidenceNote?.trim() && !hasLink) {
      return "Acceptance requires verification evidence.";
    }
    if (next.highRisk && next.creatorId === actor.id && !next.securityApprovedBy) {
      return "Separation of duties: task creator cannot unilaterally accept a high-risk work package without separate reviewer/security approval.";
    }
  }
  return null;
}
function emitActivity(db, event) {
  db.activityEvents.unshift({
    id: `act-${crypto3.randomBytes(5).toString("hex")}`,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    ...event
  });
  if (db.activityEvents.length > 250) {
    db.activityEvents.length = 250;
  }
}
function emitNotification(db, notif) {
  db.notifications.unshift({
    id: `notif-${crypto3.randomBytes(5).toString("hex")}`,
    read: false,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    ...notif
  });
  if (db.notifications.length > 200) {
    db.notifications.length = 200;
  }
}
function nextWorkPackageKey(db, projectId) {
  const project = db.projects.find((p) => p.id === projectId);
  const prefix = project ? project.key : "TRV";
  const existingNums = db.workPackages.filter((wp) => wp.projectId === projectId).map((wp) => {
    const m = wp.key.match(/-(\d+)$/);
    return m ? parseInt(m[1], 10) : 0;
  });
  const nextNum = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 101;
  return `${prefix}-${nextNum}`;
}
var WORK_PACKAGE_TYPES = /* @__PURE__ */ new Set([
  "initiative",
  "epic",
  "feature",
  "task",
  "subtask",
  "bug",
  "research",
  "tech_debt"
]);
var WORK_PACKAGE_STATUSES = /* @__PURE__ */ new Set([
  "Draft",
  "Backlog",
  "Ready",
  "In Progress",
  "In Review",
  "Verification",
  "Accepted",
  "Closed",
  "Blocked",
  "Waiting",
  "Cancelled",
  "Reopened"
]);
var PRIORITIES = /* @__PURE__ */ new Set(["Critical", "High", "Medium", "Low"]);
function isValidIsoDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}
function sanitizeLabels(input) {
  if (!Array.isArray(input)) return [];
  return Array.from(
    new Set(
      input.filter((item) => typeof item === "string").map((s) => s.trim().slice(0, 32)).filter(Boolean)
    )
  ).slice(0, 12);
}

// server.js
dotenv.config();
var PORT = Number(process.env.PORT || 3e3);
var IS_PROD = process.env.NODE_ENV === "production";
var ALLOWED_ROLES = [
  "Workspace Owner",
  "Workspace Administrator",
  "Programme Manager",
  "Project Manager",
  "Team Lead",
  "Contributor",
  "Reviewer / QA",
  "Read-only Observer",
  "External Collaborator"
];
var ALLOWED_UPLOAD_MIME = /* @__PURE__ */ new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/svg+xml"
]);
var ALLOWED_PROJECT_STATUS = /* @__PURE__ */ new Set(["Active", "Planning", "On Hold", "Archived"]);
var ALLOWED_PROJECT_HEALTH = /* @__PURE__ */ new Set(["on_track", "at_risk", "off_track"]);
var ALLOWED_MILESTONE_STATE = /* @__PURE__ */ new Set(["Planned", "At Risk", "Achieved", "Missed"]);
var ALLOWED_DOC_CATEGORIES = /* @__PURE__ */ new Set(["ADR", "RFC", "Specification", "Runbook", "Announcement"]);
var ALLOWED_DOC_STATUS = /* @__PURE__ */ new Set(["Draft", "In Review", "Accepted", "Published", "Superseded"]);
var ALLOWED_MEMBER_STATES = /* @__PURE__ */ new Set(["active", "suspended", "revoked"]);
var ALLOWED_CHAT_MODES = /* @__PURE__ */ new Set(["mentions_only", "all_messages", "muted"]);
var ALLOWED_PRESENCE = /* @__PURE__ */ new Set(["active", "focus", "reviewing", "away"]);
var WORKSPACE_OWNER_BOOTSTRAP_EMAIL = "zomerceofficial@gmail.com";
function sanitizeUser(user, db) {
  const safe = { ...user };
  delete safe.keyfileHash;
  const keyRecord = db.userKeyfileHashes?.[user.id];
  return {
    ...safe,
    hasKeyfile: Boolean(keyRecord?.hash),
    keyfileId: keyRecord?.keyId || null
  };
}
function isKeyfileConfiguredForUser(db, userId) {
  const envSha = (process.env.TRUVORNEX_ACCESS_KEY_SHA256 || "").trim();
  const envSecret = (process.env.TRUVORNEX_KEYFILE_SECRET || "").trim();
  return Boolean(envSha || envSecret || db.userKeyfileHashes?.[userId]?.hash || db.masterKeyfileHash);
}
async function createWorkspaceApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    res.setHeader("X-DNS-Prefetch-Control", "off");
    res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
    if (IS_PROD) {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
      res.setHeader("Content-Security-Policy", [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' https://apis.google.com https://accounts.google.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: blob: https://*.googleusercontent.com",
        "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com",
        "connect-src 'self' https://*.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com wss://*.firebaseio.com wss://*.firestore.googleapis.com https://*.supabase.co wss://*.supabase.co",
        "object-src 'none'",
        "base-uri 'self'"
      ].join("; "));
    }
    next();
  });
  app.use(express.json({ limit: "4mb" }));
  app.use(correlationMiddleware);
  app.use("/api", (req, res, next) => {
    if (req.body && hasPrototypePollutionKeys(req.body)) {
      res.status(400).json({ error: "Malformed request payload.", correlationId: req.correlationId });
      return;
    }
    next();
  });
  const apiLimiter = createRateLimiter({
    windowMs: 60 * 1e3,
    max: 300,
    keyFn: (req) => req.ip || "unknown"
  });
  const authLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1e3,
    max: 25,
    keyFn: (req) => {
      const body = req.body;
      const emailPart = typeof body?.email === "string" ? body.email.trim().toLowerCase().slice(0, 80) : "anon";
      return `${req.ip || "unknown"}:${emailPart}`;
    },
    message: "Too many authentication attempts. Please wait before trying again."
  });
  app.use("/api", apiLimiter);
  app.get("/api/v1/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "truvornex-engineering-workspace",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
  app.get("/api/v1/openapi.json", (_req, res) => {
    res.json({
      openapi: "3.1.0",
      info: {
        title: "Truvornex Engineering Workspace API",
        version: "2.0.0"
      },
      paths: {
        "/api/v1/health": { get: { summary: "Readiness & health probe" } },
        "/api/v1/auth/status": { get: { summary: "Check workspace session, slot capacity (8 max), and auth providers" } },
        "/api/v1/auth/exchange": { post: { summary: "Verify credentials and issue short-lived pending keyfile challenge token" } },
        "/api/v1/auth/verify-keyfile": { post: { summary: "Verify uploaded .json keyfile and upgrade pending token to full session" } },
        "/api/v1/bootstrap": { get: { summary: "Fetch authorized workspace state" } },
        "/api/v1/me/preferences": { patch: { summary: "Update presence and chat notification mode (mentions_only / all_messages / muted)" } },
        "/api/v1/chat/channels": { post: { summary: "Create workspace chat channel" } },
        "/api/v1/chat/channels/{id}/messages": { post: { summary: "Post workspace chat message with mention/all-message notification routing" } },
        "/api/v1/projects": { post: { summary: "Create project" } },
        "/api/v1/projects/{id}": { patch: { summary: "Update project governance and members" } },
        "/api/v1/work-packages": { post: { summary: "Create work package" } },
        "/api/v1/work-packages/{id}": {
          patch: { summary: "Update work package with workflow gate checks" },
          delete: { summary: "Delete work package (Admin/PM)" }
        },
        "/api/v1/dependencies": { post: { summary: "Create cycle-checked work dependency" } },
        "/api/v1/milestones/{id}": { patch: { summary: "Update milestone target or confidence" } },
        "/api/v1/documents": { post: { summary: "Create versioned knowledge document or ADR" } },
        "/api/v1/meetings": { post: { summary: "Schedule engineering meeting" } },
        "/api/v1/attachments": { post: { summary: "Upload authorized attachment" } },
        "/api/v1/attachments/{id}/download": { get: { summary: "Download authorized attachment" } },
        "/api/v1/members/invite": { post: { summary: "Invite member within strict 8-slot limit" } },
        "/api/v1/members/{id}": {
          patch: { summary: "Update member role or access state" },
          delete: { summary: "Remove member and release account slot" }
        },
        "/api/v1/audit/export": { get: { summary: "Export sanitized audit log" } }
      }
    });
  });
  app.get("/api/v1/auth/status", (req, res) => {
    const db = getDb();
    const slotsUsed = getActiveSlotCount(db);
    const providers = {
      firebase: true,
      supabase: isSupabaseServerConfigured()
    };
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice("Bearer ".length).trim();
      const payload = verifySessionToken(token);
      if (payload) {
        const user = db.users.find((u) => u.id === payload.uid);
        if (user && user.state === "active" && (!user.expiresAt || new Date(user.expiresAt).getTime() > Date.now())) {
          if (payload.scope === "pending_keyfile") {
            res.json({
              authenticated: false,
              keyfileRequired: true,
              keyfileConfigured: isKeyfileConfiguredForUser(db, user.id),
              user: sanitizeUser(user, db),
              slotsUsed,
              maxSlots: MAX_ACCOUNT_SLOTS,
              providers
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
            providers
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
      providers
    });
  });
  app.post("/api/v1/auth/exchange", authLimiter, async (req, res) => {
    const { provider, token, inviteToken } = req.body;
    if (provider !== "firebase" && provider !== "supabase" || typeof token !== "string" || !token.trim()) {
      res.status(400).json({
        error: "Valid authentication provider (firebase or supabase) and ID/access token are required.",
        correlationId: req.correlationId
      });
      return;
    }
    let identity;
    try {
      identity = provider === "firebase" ? await verifyFirebaseIdToken(token.trim()) : await verifySupabaseAccessToken(token.trim());
    } catch (err) {
      const message = err instanceof Error ? err.message : "External identity verification failed.";
      recordAudit({
        actorId: "anonymous",
        actorName: provider,
        action: `auth.${provider}_failed`,
        targetType: "Session",
        targetId: provider,
        result: "denied",
        details: message,
        correlationId: req.correlationId
      });
      res.status(401).json({ error: message, correlationId: req.correlationId });
      return;
    }
    const db = getDb();
    const providers = { firebase: true, supabase: isSupabaseServerConfigured() };
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    let matchedInvite = null;
    if (typeof inviteToken === "string" && inviteToken.trim()) {
      const tokenHash = crypto4.createHash("sha256").update(inviteToken.trim()).digest("hex");
      matchedInvite = db.invites.find((i) => i.tokenHash === tokenHash && !i.acceptedAt) || null;
      if (!matchedInvite || new Date(matchedInvite.expiresAt).getTime() <= Date.now()) {
        res.status(400).json({ error: "Invitation token is invalid or expired.", correlationId: req.correlationId });
        return;
      }
      if (matchedInvite.email.toLowerCase() !== identity.email) {
        res.status(403).json({
          error: `Invitation was issued for ${matchedInvite.email}, but signed-in account is ${identity.email}.`,
          correlationId: req.correlationId
        });
        return;
      }
    }
    let user = db.users.find((u) => u.email.toLowerCase() === identity.email || u.idpSubject === identity.subject);
    if (user) {
      if (user.state === "suspended" || user.state === "revoked") {
        recordAudit({
          actorId: user.id,
          actorName: user.displayName,
          action: "auth.login_denied_state",
          targetType: "User",
          targetId: user.id,
          result: "denied",
          details: `Blocked ${provider} sign-in because account state is ${user.state}.`,
          correlationId: req.correlationId
        });
        res.status(403).json({ error: "Your workspace account has been suspended or revoked.", correlationId: req.correlationId });
        return;
      }
      if (user.expiresAt && new Date(user.expiresAt).getTime() <= Date.now()) {
        res.status(403).json({ error: "Time-limited workspace access has expired.", correlationId: req.correlationId });
        return;
      }
      if (user.state === "invited") {
        user.state = "active";
      }
      user.idpSubject = identity.subject;
      user.authProvider = identity.provider;
      user.lastActiveAt = nowIso;
      if (matchedInvite) {
        matchedInvite.acceptedAt = nowIso;
      }
      saveDb(db);
    } else {
      const slotsUsed = getActiveSlotCount(db);
      if (slotsUsed >= MAX_ACCOUNT_SLOTS) {
        recordAudit({
          actorId: "anonymous",
          actorName: identity.email,
          action: "auth.slot_capacity_denied",
          targetType: "Workspace",
          targetId: db.workspace.id,
          result: "denied",
          details: `Rejected ${identity.email} (${provider}): ${slotsUsed}/${MAX_ACCOUNT_SLOTS} workspace account slots occupied.`,
          correlationId: req.correlationId
        });
        res.status(409).json({
          error: `Workspace account capacity reached (${slotsUsed}/${MAX_ACCOUNT_SLOTS} slots occupied). Ask a Workspace Administrator to release an existing slot or invite you.`,
          slotsUsed,
          maxSlots: MAX_ACCOUNT_SLOTS,
          correlationId: req.correlationId
        });
        return;
      }
      const allowAutoJoin = process.env.TRUVORNEX_ALLOW_AUTO_JOIN === "true";
      const allowlistedEmails = new Set((process.env.TRUVORNEX_ALLOWLIST_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean));
      const hasActiveOwner = db.users.some((u) => u.role === "Workspace Owner" && u.state === "active");
      const isOwnerCandidate = identity.email === WORKSPACE_OWNER_BOOTSTRAP_EMAIL || !hasActiveOwner;
      const isAllowlisted = allowlistedEmails.has(identity.email);
      if (!allowAutoJoin && !matchedInvite && !isOwnerCandidate && !isAllowlisted) {
        recordAudit({
          actorId: "anonymous",
          actorName: identity.email,
          action: "auth.unprovisioned_denied",
          targetType: "Workspace",
          targetId: db.workspace.id,
          result: "denied",
          details: `Blocked unprovisioned account ${identity.email} (${provider}). Self-registration is disabled.`,
          correlationId: req.correlationId
        });
        res.status(403).json({
          error: "Access restricted: self-registration is disabled. Only the 8 accounts provisioned by the Workspace Owner in Firebase Auth or Supabase may sign in.",
          correlationId: req.correlationId
        });
        return;
      }
      const assignedRole = matchedInvite ? matchedInvite.role : isOwnerCandidate ? "Workspace Owner" : "Contributor";
      user = {
        id: `usr-${crypto4.randomBytes(4).toString("hex")}`,
        idpSubject: identity.subject,
        authProvider: identity.provider,
        displayName: matchedInvite?.displayName || identity.displayName,
        email: identity.email,
        title: matchedInvite?.title || (assignedRole === "Workspace Owner" ? "Workspace Owner" : "Software Engineer"),
        role: assignedRole,
        state: "active",
        mfaEnabled: true,
        timezone: db.workspace.defaultTimezone || "UTC",
        joinedAt: nowIso,
        lastActiveAt: nowIso,
        expiresAt: null,
        presence: "active",
        chatNotificationMode: "mentions_only",
        notifyOnChannelAll: true,
        desktopAlerts: false,
        channelNotificationModes: {}
      };
      db.users.push(user);
      for (const proj of db.projects) {
        if (proj.visibility === "internal" || assignedRole === "Workspace Owner") {
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
        action: "member.provisioned",
        targetType: "User",
        targetId: user.id,
        result: "success",
        details: `Provisioned ${user.email} via ${provider} in slot ${getActiveSlotCount(db)}/${MAX_ACCOUNT_SLOTS} as ${user.role}.`,
        correlationId: req.correlationId
      });
    }
    const pendingToken = signSessionToken(user.id, 60 * 10, "pending_keyfile");
    const keyfileConfigured = isKeyfileConfiguredForUser(db, user.id);
    recordAudit({
      actorId: user.id,
      actorName: user.displayName,
      action: `auth.${provider}_stage1_verified`,
      targetType: "Session",
      targetId: user.id,
      result: "success",
      details: `Stage 1 identity verified via ${provider} (${user.email}); awaiting JSON keyfile verification.`,
      correlationId: req.correlationId
    });
    res.json({
      authenticated: false,
      keyfileRequired: true,
      keyfileConfigured,
      pendingToken,
      user: sanitizeUser(user, db),
      slotsUsed: getActiveSlotCount(db),
      maxSlots: MAX_ACCOUNT_SLOTS,
      providers
    });
  });
  app.post("/api/v1/auth/verify-keyfile", authLimiter, (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Pending login session is required before key file verification.", correlationId: req.correlationId });
      return;
    }
    const pendingToken = authHeader.slice("Bearer ".length).trim();
    const payload = verifySessionToken(pendingToken);
    if (!payload || payload.scope !== "pending_keyfile") {
      res.status(401).json({ error: "Pending login session expired or invalid. Please log in again.", correlationId: req.correlationId });
      return;
    }
    const db = getDb();
    const user = db.users.find((u) => u.id === payload.uid);
    if (!user || user.state !== "active") {
      res.status(403).json({ error: "Your workspace account has been suspended or revoked.", correlationId: req.correlationId });
      return;
    }
    if (user.expiresAt && new Date(user.expiresAt).getTime() <= Date.now()) {
      res.status(403).json({ error: "Time-limited workspace access has expired.", correlationId: req.correlationId });
      return;
    }
    const { keyData } = req.body || {};
    const digests = extractKeyfileDigests(keyData);
    if (!digests) {
      recordAudit({
        actorId: user.id,
        actorName: user.displayName,
        action: "auth.keyfile_denied",
        targetType: "Session",
        targetId: user.id,
        result: "denied",
        details: "Rejected malformed or empty JSON key file.",
        correlationId: req.correlationId
      });
      res.status(400).json({ error: "Upload a valid non-empty .json key file.", correlationId: req.correlationId });
      return;
    }
    const envSha = (process.env.TRUVORNEX_ACCESS_KEY_SHA256 || "").trim().toLowerCase();
    const envSecret = (process.env.TRUVORNEX_KEYFILE_SECRET || "").trim();
    const userKeyRecord = db.userKeyfileHashes?.[user.id];
    const masterKeyHash = db.masterKeyfileHash || null;
    const candidateHashes = [];
    if (userKeyRecord?.hash) {
      candidateHashes.push(userKeyRecord.hash);
    } else if (masterKeyHash) {
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
      const hasActiveOwner = db.users.some((u) => u.role === "Workspace Owner" && u.state === "active");
      const canClaimInitialKey = user.role === "Workspace Owner" || !hasActiveOwner;
      if (!canClaimInitialKey) {
        recordAudit({
          actorId: user.id,
          actorName: user.displayName,
          action: "auth.keyfile_unconfigured_denied",
          targetType: "Session",
          targetId: user.id,
          result: "denied",
          details: "No JSON key file configured for account or workspace yet.",
          correlationId: req.correlationId
        });
        res.status(403).json({
          error: "No JSON key file has been configured for this account yet. Ask the Workspace Owner to issue your key file.",
          correlationId: req.correlationId
        });
        return;
      }
      const claimedHash = digests.secretDigest || digests.canonicalDigest;
      const keyId = `trv-key-${crypto4.randomBytes(4).toString("hex")}`;
      db.masterKeyfileHash = claimedHash;
      db.userKeyfileHashes = db.userKeyfileHashes || {};
      db.userKeyfileHashes[user.id] = {
        hash: claimedHash,
        keyId,
        issuedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      saveDb(db);
      verified = true;
      recordAudit({
        actorId: user.id,
        actorName: user.displayName,
        action: "auth.keyfile_initialized",
        targetType: "Workspace",
        targetId: db.workspace.id,
        result: "success",
        details: `Initial workspace JSON keyfile claimed by ${user.email} (${keyId}).`,
        correlationId: req.correlationId
      });
    } else {
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
        action: "auth.keyfile_denied",
        targetType: "Session",
        targetId: user.id,
        result: "denied",
        details: `Rejected invalid JSON key file for ${user.email}.`,
        correlationId: req.correlationId
      });
      res.status(403).json({ error: "Invalid JSON key file.", correlationId: req.correlationId });
      return;
    }
    revokeSessionToken(pendingToken);
    const fullToken = signSessionToken(user.id, 60 * 60 * 8, "full");
    user.lastActiveAt = (/* @__PURE__ */ new Date()).toISOString();
    saveDb(db);
    recordAudit({
      actorId: user.id,
      actorName: user.displayName,
      action: "auth.keyfile_verified",
      targetType: "Session",
      targetId: user.id,
      result: "success",
      details: `Completed two-stage JSON keyfile login for ${user.email}.`,
      correlationId: req.correlationId
    });
    res.json({
      authenticated: true,
      keyfileRequired: false,
      keyfileConfigured: true,
      token: fullToken,
      user: sanitizeUser(user, db),
      slotsUsed: getActiveSlotCount(db),
      maxSlots: MAX_ACCOUNT_SLOTS,
      providers: { firebase: true, supabase: isSupabaseServerConfigured() }
    });
  });
  app.post("/api/v1/auth/logout", requireAuth, (req, res) => {
    if (req.authToken)
      revokeSessionToken(req.authToken);
    if (req.authUser) {
      recordAudit({
        actorId: req.authUser.id,
        actorName: req.authUser.displayName,
        action: "auth.logout",
        targetType: "Session",
        targetId: req.authUser.id,
        result: "success",
        details: "Session terminated by user.",
        correlationId: req.correlationId
      });
    }
    res.json({ ok: true });
  });
  app.post("/api/v1/auth/switch-account", requireAuth, (req, res) => {
    const actor = req.authUser;
    if (actor.role !== "Workspace Owner" && actor.role !== "Workspace Administrator") {
      res.status(403).json({ error: "Only Workspace Owners/Administrators can switch test identities." });
      return;
    }
    const { targetUserId } = req.body;
    if (!targetUserId || typeof targetUserId !== "string") {
      res.status(400).json({ error: "targetUserId is required." });
      return;
    }
    const db = getDb();
    const target = db.users.find((u) => u.id === targetUserId);
    if (!target || target.state !== "active") {
      res.status(404).json({ error: "Target active user not found." });
      return;
    }
    if (target.role === "Workspace Owner" && actor.role !== "Workspace Owner") {
      recordAudit({
        actorId: actor.id,
        actorName: actor.displayName,
        action: "auth.privilege_escalation_denied",
        targetType: "User",
        targetId: target.id,
        result: "denied",
        details: `${actor.displayName} (${actor.role}) blocked from switching into Workspace Owner identity.`,
        correlationId: req.correlationId
      });
      res.status(403).json({ error: "Workspace Administrators cannot escalate into Workspace Owner identity." });
      return;
    }
    const token = signSessionToken(target.id);
    recordAudit({
      actorId: actor.id,
      actorName: actor.displayName,
      action: "auth.role_context_switch",
      targetType: "User",
      targetId: target.id,
      result: "success",
      details: `${actor.displayName} initiated authorized workspace view as ${target.displayName} (${target.role}).`,
      correlationId: req.correlationId
    });
    res.json({
      authenticated: true,
      user: sanitizeUser(target, db),
      token,
      slotsUsed: getActiveSlotCount(db),
      maxSlots: MAX_ACCOUNT_SLOTS,
      providers: { firebase: true, supabase: isSupabaseServerConfigured() }
    });
  });
  app.get("/api/v1/bootstrap", requireAuth, (req, res) => {
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
    const comments = db.comments.filter((c) => c.resourceType === "work_package" ? visibleWpIds.has(c.resourceId) : visibleDocIds.has(c.resourceId));
    const attachments = db.attachments.filter((a) => {
      if (!visibleProjectIds.has(a.projectId))
        return false;
      if (a.parentType === "document")
        return visibleDocIds.has(a.parentId);
      return visibleWpIds.has(a.parentId);
    });
    const externalLinks = db.externalLinks.filter((l) => visibleProjectIds.has(l.projectId));
    const activityEvents = db.activityEvents.filter((a) => !a.projectId || visibleProjectIds.has(a.projectId));
    const meetings = db.meetings.filter((m) => !m.projectId || visibleProjectIds.has(m.projectId));
    const notifications = db.notifications.filter((n) => n.recipientId === user.id || isWorkspaceAdmin(user.role));
    const auditEvents = isWorkspaceAdmin(user.role) || user.role === "Programme Manager" ? db.auditEvents : [];
    const visibleChannels = db.chatChannels.filter((ch) => {
      if (ch.projectId && !visibleProjectIds.has(ch.projectId))
        return false;
      if (ch.isPrivate) {
        return user.role === "Workspace Owner" || isWorkspaceAdmin(user.role) || ch.createdBy === user.id || Array.isArray(ch.memberIds) && ch.memberIds.includes(user.id);
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
        supabase: isSupabaseServerConfigured()
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
      integrations: isWorkspaceAdmin(user.role) || user.role !== "External Collaborator" ? db.integrations : [],
      externalLinks,
      notifications,
      auditEvents,
      activityEvents,
      meetings,
      savedViews: db.savedViews,
      chatChannels: visibleChannels,
      chatMessages
    });
  });
  app.patch("/api/v1/me/preferences", requireAuth, (req, res) => {
    const actor = req.authUser;
    const db = getDb();
    const user = db.users.find((u) => u.id === actor.id);
    if (!user) {
      res.status(404).json({ error: "User not found." });
      return;
    }
    const { chatNotificationMode, notifyOnChannelAll, desktopAlerts, presence, timezone, channelNotificationModes } = req.body;
    if (chatNotificationMode !== void 0) {
      if (!ALLOWED_CHAT_MODES.has(chatNotificationMode)) {
        res.status(400).json({ error: "Invalid chatNotificationMode." });
        return;
      }
      user.chatNotificationMode = chatNotificationMode;
    }
    if (typeof notifyOnChannelAll === "boolean") {
      user.notifyOnChannelAll = notifyOnChannelAll;
    }
    if (typeof desktopAlerts === "boolean") {
      user.desktopAlerts = desktopAlerts;
    }
    if (presence !== void 0) {
      if (!ALLOWED_PRESENCE.has(presence)) {
        res.status(400).json({ error: "Invalid presence value." });
        return;
      }
      user.presence = presence;
    }
    if (typeof timezone === "string" && timezone.trim()) {
      user.timezone = timezone.trim().slice(0, 64);
    }
    if (channelNotificationModes && typeof channelNotificationModes === "object") {
      const nextMap = { ...user.channelNotificationModes || {} };
      for (const [cid, mode] of Object.entries(channelNotificationModes)) {
        if (db.chatChannels.some((c) => c.id === cid) && ALLOWED_CHAT_MODES.has(mode)) {
          nextMap[cid] = mode;
        }
      }
      user.channelNotificationModes = nextMap;
    }
    user.lastActiveAt = (/* @__PURE__ */ new Date()).toISOString();
    saveDb(db);
    res.json(sanitizeUser(user, db));
  });
  app.post("/api/v1/chat/channels", requireAuth, (req, res) => {
    const actor = req.authUser;
    if (!canEditWork(actor.role)) {
      res.status(403).json({ error: "Read-only observers cannot create channels." });
      return;
    }
    if (containsOperatorConsoleViolation(req.body)) {
      res.status(403).json({ error: "Trust boundary violation." });
      return;
    }
    const { name, topic, projectId, isPrivate } = req.body;
    if (typeof name !== "string" || !name.trim()) {
      res.status(400).json({ error: "Channel name is required." });
      return;
    }
    const cleanName = name.trim().toLowerCase().replace(/[^a-z0-9-_]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
    if (cleanName.length < 2) {
      res.status(400).json({ error: "Channel name must contain at least 2 alphanumeric characters." });
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
        res.status(403).json({ error: "Referenced project not found or access denied." });
        return;
      }
    }
    const channel = {
      id: `ch-${crypto4.randomBytes(4).toString("hex")}`,
      name: cleanName,
      topic: typeof topic === "string" ? topic.trim().slice(0, 240) : "",
      projectId: projectId || null,
      isPrivate: Boolean(isPrivate),
      createdBy: actor.id,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      memberIds: isPrivate ? [actor.id] : void 0
    };
    db.chatChannels.push(channel);
    saveDb(db);
    res.status(201).json(channel);
  });
  app.post("/api/v1/chat/channels/:id/messages", requireAuth, (req, res) => {
    const actor = req.authUser;
    if (!canEditWork(actor.role)) {
      res.status(403).json({ error: "Read-only observers cannot post workspace messages." });
      return;
    }
    if (containsOperatorConsoleViolation(req.body)) {
      res.status(403).json({ error: "Trust boundary violation." });
      return;
    }
    const db = getDb();
    const channel = db.chatChannels.find((c) => c.id === req.params.id);
    if (!channel) {
      res.status(404).json({ error: "Chat channel not found." });
      return;
    }
    if (channel.projectId) {
      const proj2 = db.projects.find((p) => p.id === channel.projectId);
      if (proj2 && !canViewProject(actor, proj2)) {
        res.status(403).json({ error: "Access denied to channel project scope." });
        return;
      }
    }
    if (channel.isPrivate && actor.role !== "Workspace Owner" && !isWorkspaceAdmin(actor.role) && channel.createdBy !== actor.id && !(channel.memberIds || []).includes(actor.id)) {
      res.status(403).json({ error: "Access denied to private channel." });
      return;
    }
    const { body, parentMessageId } = req.body;
    if (typeof body !== "string" || !body.trim()) {
      res.status(400).json({ error: "Message text is required." });
      return;
    }
    const cleanBody = body.trim().slice(0, 4e3);
    let parentMsg;
    if (parentMessageId) {
      parentMsg = db.chatMessages.find((m) => m.id === parentMessageId && m.channelId === channel.id);
      if (!parentMsg) {
        res.status(404).json({ error: "Parent thread message not found in channel." });
        return;
      }
    }
    const lowerBody = cleanBody.toLowerCase();
    const mentions = db.users.filter((u) => {
      if (u.state !== "active")
        return false;
      const firstName = u.displayName.toLowerCase().split(" ")[0];
      const fullHandle = u.displayName.toLowerCase().replace(/\s+/g, "");
      return lowerBody.includes(`@${firstName}`) || lowerBody.includes(`@${u.displayName.toLowerCase()}`) || lowerBody.includes(`@${fullHandle}`);
    }).map((u) => u.id);
    const mentionAll = /@(all|channel|here)\b/i.test(cleanBody);
    const workKeyMatch = cleanBody.match(/#([A-Z]{2,8}-\d+)/);
    const linkedWorkKey = workKeyMatch ? db.workPackages.find((w) => w.key.toUpperCase() === workKeyMatch[1].toUpperCase())?.key || null : null;
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const msg = {
      id: `msg-${crypto4.randomBytes(5).toString("hex")}`,
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
      updatedAt: nowIso
    };
    db.chatMessages.push(msg);
    const proj = channel.projectId ? db.projects.find((p) => p.id === channel.projectId) : void 0;
    for (const recipient of db.users) {
      if (recipient.id === actor.id || recipient.state !== "active")
        continue;
      if (proj && !canViewProject(recipient, proj))
        continue;
      if (channel.isPrivate && recipient.role !== "Workspace Owner" && !isWorkspaceAdmin(recipient.role) && channel.createdBy !== recipient.id && !(channel.memberIds || []).includes(recipient.id)) {
        continue;
      }
      const mode = recipient.channelNotificationModes?.[channel.id] || recipient.chatNotificationMode || "mentions_only";
      if (mode === "muted")
        continue;
      const isDirectMention = mentions.includes(recipient.id);
      const isThreadReplyToRecipient = Boolean(parentMsg && parentMsg.authorId === recipient.id);
      const isChannelBroadcast = mentionAll && recipient.notifyOnChannelAll !== false;
      if (mode === "all_messages" || isDirectMention || isThreadReplyToRecipient || isChannelBroadcast) {
        emitNotification(db, {
          recipientId: recipient.id,
          category: isDirectMention || isChannelBroadcast ? "mention" : "chat",
          title: isDirectMention ? `Mentioned in #${channel.name}` : isThreadReplyToRecipient ? `Thread reply in #${channel.name}` : `New message in #${channel.name}`,
          summary: `${actor.displayName}: ${cleanBody.slice(0, 140)}`,
          resourceType: "chat_channel",
          resourceId: channel.id,
          securityCritical: false
        });
      }
    }
    saveDb(db);
    res.status(201).json(msg);
  });
  app.patch("/api/v1/chat/messages/:id", requireAuth, (req, res) => {
    const actor = req.authUser;
    const db = getDb();
    const msg = db.chatMessages.find((m) => m.id === req.params.id);
    if (!msg) {
      res.status(404).json({ error: "Message not found." });
      return;
    }
    const isAuthor = msg.authorId === actor.id;
    if (!isAuthor && !isWorkspaceAdmin(actor.role)) {
      res.status(403).json({ error: "Only the author or a Workspace Administrator can edit or pin this message." });
      return;
    }
    const { body, pinned } = req.body;
    if (typeof body === "string") {
      if (!isAuthor && !isWorkspaceAdmin(actor.role)) {
        res.status(403).json({ error: "Only the author may edit message text." });
        return;
      }
      if (!body.trim()) {
        res.status(400).json({ error: "Message text cannot be empty." });
        return;
      }
      msg.body = body.trim().slice(0, 4e3);
      msg.edited = true;
    }
    if (typeof pinned === "boolean") {
      msg.pinned = pinned;
    }
    msg.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    saveDb(db);
    res.json(msg);
  });
  app.delete("/api/v1/chat/messages/:id", requireAuth, (req, res) => {
    const actor = req.authUser;
    const db = getDb();
    const msg = db.chatMessages.find((m) => m.id === req.params.id);
    if (!msg) {
      res.status(404).json({ error: "Message not found." });
      return;
    }
    if (msg.authorId !== actor.id && !isWorkspaceAdmin(actor.role)) {
      res.status(403).json({ error: "Only the author or an administrator may delete this message." });
      return;
    }
    db.chatMessages = db.chatMessages.filter((m) => m.id !== msg.id && m.parentMessageId !== msg.id);
    saveDb(db);
    res.json({ ok: true });
  });
  app.post("/api/v1/chat/messages/:id/react", requireAuth, (req, res) => {
    const actor = req.authUser;
    const db = getDb();
    const msg = db.chatMessages.find((m) => m.id === req.params.id);
    if (!msg) {
      res.status(404).json({ error: "Message not found." });
      return;
    }
    const { label } = req.body;
    const allowed = /* @__PURE__ */ new Set(["\u{1F44D}", "\u2705", "\u{1F440}", "\u{1F680}", "ACK"]);
    const cleanLabel = typeof label === "string" && allowed.has(label) ? label : "\u{1F44D}";
    const current = msg.reactions[cleanLabel] || [];
    if (current.includes(actor.id)) {
      msg.reactions[cleanLabel] = current.filter((id) => id !== actor.id);
    } else {
      msg.reactions[cleanLabel] = [...current, actor.id];
    }
    saveDb(db);
    res.json(msg);
  });
  app.post("/api/v1/chat/channels/:id/read", requireAuth, (req, res) => {
    const actor = req.authUser;
    const db = getDb();
    for (const n of db.notifications) {
      if (n.recipientId === actor.id && n.resourceType === "chat_channel" && n.resourceId === req.params.id) {
        n.read = true;
      }
    }
    saveDb(db);
    res.json({ ok: true });
  });
  app.get("/api/v1/search", requireAuth, (req, res) => {
    const q = String(req.query.q || "").trim().toLowerCase().slice(0, 120);
    const db = getDb();
    const user = req.authUser;
    const visibleProjects = db.projects.filter((p) => canViewProject(user, p));
    const visibleProjectIds = new Set(visibleProjects.map((p) => p.id));
    if (!q) {
      res.json({ projects: [], workPackages: [], documents: [], users: [] });
      return;
    }
    const projects = visibleProjects.filter((p) => p.name.toLowerCase().includes(q) || p.key.toLowerCase().includes(q) || p.objective.toLowerCase().includes(q));
    const workPackages = db.workPackages.filter((wp) => visibleProjectIds.has(wp.projectId) && (wp.key.toLowerCase().includes(q) || wp.title.toLowerCase().includes(q) || wp.description.toLowerCase().includes(q) || wp.labels.some((l) => l.toLowerCase().includes(q))));
    const documents = db.documents.filter((doc) => canViewDocument(user, doc, db.projects) && (doc.title.toLowerCase().includes(q) || doc.body.toLowerCase().includes(q) || doc.category.toLowerCase().includes(q)));
    const users = db.users.filter((u) => u.displayName.toLowerCase().includes(q) || u.title.toLowerCase().includes(q) || u.role.toLowerCase().includes(q));
    res.json({ projects, workPackages, documents, users });
  });
  app.post("/api/v1/projects", requireAuth, (req, res) => {
    const actor = req.authUser;
    if (!canManageProjects(actor.role)) {
      res.status(403).json({ error: "Only Programme/Project Managers or Admins can create projects." });
      return;
    }
    if (containsOperatorConsoleViolation(req.body)) {
      recordAudit({
        actorId: actor.id,
        actorName: actor.displayName,
        action: "security.operator_boundary_violation",
        targetType: "Project",
        targetId: "new",
        result: "denied",
        details: "Blocked attempt to create production operator control project.",
        correlationId: req.correlationId
      });
      res.status(403).json({ error: "Trust boundary violation: Production Operator Console resources cannot be created here." });
      return;
    }
    const body = req.body;
    if (typeof body.key !== "string" || typeof body.name !== "string" || typeof body.objective !== "string" || !body.key.trim() || !body.name.trim() || !body.objective.trim()) {
      res.status(400).json({ error: "Project key, name, and objective are required." });
      return;
    }
    const db = getDb();
    const cleanKey = body.key.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
    if (cleanKey.length < 2) {
      res.status(400).json({ error: "Project key must include at least 2 alphanumeric characters." });
      return;
    }
    if (db.projects.some((p) => p.key === cleanKey)) {
      res.status(409).json({ error: `Project key ${cleanKey} already exists.` });
      return;
    }
    const validUserIds = new Set(db.users.map((u) => u.id));
    const ownerId = typeof body.ownerId === "string" && validUserIds.has(body.ownerId) ? body.ownerId : actor.id;
    const sponsorId = typeof body.sponsorId === "string" && validUserIds.has(body.sponsorId) ? body.sponsorId : actor.id;
    const rawMembers = Array.isArray(body.memberIds) ? body.memberIds.filter((id) => validUserIds.has(id)) : [];
    const project = {
      id: `proj-${crypto4.randomBytes(4).toString("hex")}`,
      key: cleanKey,
      name: body.name.trim().slice(0, 120),
      programme: typeof body.programme === "string" && body.programme.trim() ? body.programme.trim().slice(0, 80) : "Truvornex Core v1",
      objective: body.objective.trim().slice(0, 500),
      ownerId,
      sponsorId,
      status: body.status && ALLOWED_PROJECT_STATUS.has(body.status) ? body.status : "Active",
      health: body.health && ALLOWED_PROJECT_HEALTH.has(body.health) ? body.health : "on_track",
      healthNote: typeof body.healthNote === "string" && body.healthNote.trim() ? body.healthNote.trim().slice(0, 500) : "Initial project baseline established.",
      visibility: body.visibility === "restricted" ? "restricted" : "internal",
      startDate: isValidIsoDate(body.startDate) ? body.startDate : "2026-11-26",
      targetDate: isValidIsoDate(body.targetDate) ? body.targetDate : "2027-02-28",
      participatingTeamIds: Array.isArray(body.participatingTeamIds) ? body.participatingTeamIds.filter((id) => typeof id === "string") : [],
      memberIds: Array.from(/* @__PURE__ */ new Set([actor.id, ownerId, ...rawMembers])),
      linkedDocIds: []
    };
    db.projects.push(project);
    emitActivity(db, {
      actorId: actor.id,
      action: "created project",
      resourceType: "project",
      resourceId: project.id,
      resourceKey: project.key,
      resourceTitle: project.name,
      projectId: project.id,
      summary: `Created ${project.visibility} project ${project.key}.`
    });
    saveDb(db);
    recordAudit({
      actorId: actor.id,
      actorName: actor.displayName,
      action: "project.created",
      targetType: "Project",
      targetId: project.key,
      result: "success",
      details: `Created project ${project.name} (${project.visibility}).`,
      correlationId: req.correlationId
    });
    res.status(201).json(project);
  });
  app.patch("/api/v1/projects/:id", requireAuth, (req, res) => {
    const actor = req.authUser;
    if (!canManageProjects(actor.role)) {
      res.status(403).json({ error: "Insufficient permissions to modify project." });
      return;
    }
    if (containsOperatorConsoleViolation(req.body)) {
      res.status(403).json({ error: "Trust boundary violation: prohibited production operator payload." });
      return;
    }
    const db = getDb();
    const project = db.projects.find((p) => p.id === req.params.id);
    if (!project || !canViewProject(actor, project)) {
      res.status(404).json({ error: "Project not found or access denied." });
      return;
    }
    const updates = req.body;
    if (updates.visibility !== void 0) {
      if (updates.visibility !== "internal" && updates.visibility !== "restricted") {
        res.status(400).json({ error: "Invalid project visibility value." });
        return;
      }
      if (updates.visibility !== project.visibility) {
        recordAudit({
          actorId: actor.id,
          actorName: actor.displayName,
          action: "project.visibility.changed",
          targetType: "Project",
          targetId: project.key,
          result: "success",
          details: `Changed visibility from ${project.visibility} to ${updates.visibility}.`,
          correlationId: req.correlationId
        });
        project.visibility = updates.visibility;
      }
    }
    if (updates.health !== void 0) {
      if (!ALLOWED_PROJECT_HEALTH.has(updates.health)) {
        res.status(400).json({ error: "Invalid project health value." });
        return;
      }
      project.health = updates.health;
    }
    if (typeof updates.healthNote === "string") {
      project.healthNote = updates.healthNote.trim().slice(0, 500);
    }
    if (typeof updates.objective === "string" && updates.objective.trim()) {
      project.objective = updates.objective.trim().slice(0, 500);
    }
    if (typeof updates.name === "string" && updates.name.trim()) {
      project.name = updates.name.trim().slice(0, 120);
    }
    if (updates.status !== void 0) {
      if (!ALLOWED_PROJECT_STATUS.has(updates.status)) {
        res.status(400).json({ error: "Invalid project status value." });
        return;
      }
      project.status = updates.status;
    }
    if (isValidIsoDate(updates.targetDate)) {
      project.targetDate = updates.targetDate;
    }
    if (Array.isArray(updates.memberIds)) {
      const validUserIds = new Set(db.users.map((u) => u.id));
      const cleanMembers = Array.from(/* @__PURE__ */ new Set([project.ownerId, ...updates.memberIds.filter((id) => typeof id === "string" && validUserIds.has(id))]));
      project.memberIds = cleanMembers;
    }
    saveDb(db);
    res.json(project);
  });
  app.post("/api/v1/work-packages", requireAuth, (req, res) => {
    const actor = req.authUser;
    if (!canEditWork(actor.role)) {
      res.status(403).json({ error: "Read-only observers cannot create work packages." });
      return;
    }
    if (containsOperatorConsoleViolation(req.body)) {
      res.status(403).json({ error: "Trust boundary violation: Production Operator Console references are prohibited." });
      return;
    }
    const db = getDb();
    const body = req.body;
    const project = db.projects.find((p) => p.id === body.projectId);
    if (!project || !canViewProject(actor, project)) {
      res.status(404).json({ error: "Target project not found or access denied." });
      return;
    }
    if (typeof body.title !== "string" || !body.title.trim() || !body.type || !WORK_PACKAGE_TYPES.has(body.type)) {
      res.status(400).json({ error: "Valid work package title and type are required." });
      return;
    }
    const status = body.status || "Draft";
    if (!WORK_PACKAGE_STATUSES.has(status)) {
      res.status(400).json({ error: "Invalid work package status." });
      return;
    }
    const priority = body.priority || "Medium";
    if (!PRIORITIES.has(priority)) {
      res.status(400).json({ error: "Invalid priority." });
      return;
    }
    const validUserIds = new Set(db.users.map((u) => u.id));
    const ownerId = typeof body.ownerId === "string" && validUserIds.has(body.ownerId) ? body.ownerId : actor.id;
    const reviewerId = typeof body.reviewerId === "string" && validUserIds.has(body.reviewerId) ? body.reviewerId : null;
    const milestoneId = typeof body.milestoneId === "string" && db.milestones.some((m) => m.id === body.milestoneId && m.projectId === project.id) ? body.milestoneId : null;
    const estimateRaw = Number(body.estimateHours);
    const estimateHours = Number.isFinite(estimateRaw) ? Math.min(2e3, Math.max(1, Math.round(estimateRaw))) : 8;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const wp = {
      id: `wp-${crypto4.randomBytes(4).toString("hex")}`,
      key: nextWorkPackageKey(db, project.id),
      projectId: project.id,
      parentId: typeof body.parentId === "string" ? body.parentId : null,
      type: body.type,
      title: body.title.trim().slice(0, 180),
      description: typeof body.description === "string" ? body.description.trim().slice(0, 8e3) : "",
      status,
      priority,
      ownerId,
      assigneeIds: Array.isArray(body.assigneeIds) ? body.assigneeIds.filter((id) => typeof id === "string" && validUserIds.has(id)) : [ownerId],
      reviewerId,
      creatorId: actor.id,
      teamId: typeof body.teamId === "string" ? body.teamId : project.participatingTeamIds[0] || null,
      milestoneId,
      startDate: isValidIsoDate(body.startDate) ? body.startDate : "2026-11-26",
      dueDate: isValidIsoDate(body.dueDate) ? body.dueDate : "2026-12-12",
      estimateHours,
      labels: sanitizeLabels(body.labels),
      acceptanceCriteria: typeof body.acceptanceCriteria === "string" ? body.acceptanceCriteria.trim().slice(0, 4e3) : "",
      dependenciesConfirmedNone: Boolean(body.dependenciesConfirmedNone),
      blockerReason: typeof body.blockerReason === "string" ? body.blockerReason.trim().slice(0, 500) : void 0,
      blockerOwnerId: typeof body.blockerOwnerId === "string" && validUserIds.has(body.blockerOwnerId) ? body.blockerOwnerId : null,
      nextReviewDate: isValidIsoDate(body.nextReviewDate) ? body.nextReviewDate : void 0,
      blockerExceptionReason: typeof body.blockerExceptionReason === "string" ? body.blockerExceptionReason.trim().slice(0, 500) : void 0,
      evidenceNote: typeof body.evidenceNote === "string" ? body.evidenceNote.trim().slice(0, 1e3) : void 0,
      highRisk: Boolean(body.highRisk),
      securityApprovedBy: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
      history: []
    };
    const gateError = validateWorkPackageTransition({
      db,
      actor,
      existing: { ...wp, status: "Draft" },
      next: wp
    });
    if (gateError) {
      res.status(400).json({ error: gateError });
      return;
    }
    db.workPackages.unshift(wp);
    emitActivity(db, {
      actorId: actor.id,
      action: "created",
      resourceType: "work_package",
      resourceId: wp.id,
      resourceKey: wp.key,
      resourceTitle: wp.title,
      projectId: wp.projectId,
      summary: `Created ${wp.type} ${wp.key} in ${wp.status}.`
    });
    if (wp.ownerId !== actor.id) {
      emitNotification(db, {
        recipientId: wp.ownerId,
        category: "assignment",
        title: `Assigned owner of ${wp.key}`,
        summary: `${actor.displayName} created ${wp.key}: ${wp.title}`,
        resourceType: "work_package",
        resourceId: wp.id,
        securityCritical: false
      });
    }
    saveDb(db);
    res.status(201).json(wp);
  });
  app.patch("/api/v1/work-packages/:id", requireAuth, (req, res) => {
    const actor = req.authUser;
    if (!canEditWork(actor.role)) {
      res.status(403).json({ error: "Read-only observers cannot edit work packages." });
      return;
    }
    if (containsOperatorConsoleViolation(req.body)) {
      res.status(403).json({ error: "Trust boundary violation: Production Operator Console references are prohibited." });
      return;
    }
    const db = getDb();
    const idx = db.workPackages.findIndex((w) => w.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: "Work package not found." });
      return;
    }
    const existing = db.workPackages[idx];
    const project = db.projects.find((p) => p.id === existing.projectId);
    if (!project || !canViewProject(actor, project)) {
      res.status(403).json({ error: "Access denied to this project." });
      return;
    }
    const patch = req.body;
    if (typeof patch.version === "number" && patch.version !== existing.version) {
      res.status(409).json({
        error: `Version conflict: server is at v${existing.version}, client sent v${patch.version}. Refresh before saving.`
      });
      return;
    }
    const validUserIds = new Set(db.users.map((u) => u.id));
    if (patch.status !== void 0 && !WORK_PACKAGE_STATUSES.has(patch.status)) {
      res.status(400).json({ error: "Invalid work package status." });
      return;
    }
    if (patch.priority !== void 0 && !PRIORITIES.has(patch.priority)) {
      res.status(400).json({ error: "Invalid work package priority." });
      return;
    }
    if (patch.ownerId !== void 0 && !validUserIds.has(patch.ownerId)) {
      res.status(400).json({ error: "Invalid owner user reference." });
      return;
    }
    if (patch.reviewerId !== void 0 && patch.reviewerId !== null && patch.reviewerId !== "" && !validUserIds.has(patch.reviewerId)) {
      res.status(400).json({ error: "Invalid reviewer user reference." });
      return;
    }
    if (patch.blockerOwnerId !== void 0 && patch.blockerOwnerId !== null && patch.blockerOwnerId !== "" && !validUserIds.has(patch.blockerOwnerId)) {
      res.status(400).json({ error: "Invalid blocker owner reference." });
      return;
    }
    if (patch.startDate !== void 0 && !isValidIsoDate(patch.startDate)) {
      res.status(400).json({ error: "Invalid startDate format (expected YYYY-MM-DD)." });
      return;
    }
    if (patch.dueDate !== void 0 && !isValidIsoDate(patch.dueDate)) {
      res.status(400).json({ error: "Invalid dueDate format (expected YYYY-MM-DD)." });
      return;
    }
    if (patch.nextReviewDate !== void 0 && patch.nextReviewDate !== "" && !isValidIsoDate(patch.nextReviewDate)) {
      res.status(400).json({ error: "Invalid nextReviewDate format (expected YYYY-MM-DD)." });
      return;
    }
    if (patch.milestoneId !== void 0 && patch.milestoneId !== null && patch.milestoneId !== "") {
      const validMs = db.milestones.some((m) => m.id === patch.milestoneId && m.projectId === existing.projectId);
      if (!validMs) {
        res.status(400).json({ error: "Invalid milestone reference for this project." });
        return;
      }
    }
    let securityApprovedBy = existing.securityApprovedBy || null;
    if (patch.approveSecurity === true) {
      if (!canApproveWork(actor.role)) {
        res.status(403).json({ error: "Only Reviewers, Team Leads, Project Managers, or Admins can grant security approval." });
        return;
      }
      if (actor.id === existing.creatorId) {
        res.status(403).json({ error: "Separation of duties: task creator cannot self-approve high-risk security sign-off." });
        return;
      }
      securityApprovedBy = actor.id;
      recordAudit({
        actorId: actor.id,
        actorName: actor.displayName,
        action: "work_package.security_approved",
        targetType: "WorkPackage",
        targetId: existing.key,
        result: "success",
        details: `Granted independent security/reviewer sign-off on ${existing.key}.`,
        correlationId: req.correlationId
      });
    }
    const nextTitle = typeof patch.title === "string" && patch.title.trim() ? patch.title.trim().slice(0, 180) : existing.title;
    const nextEstimate = typeof patch.estimateHours === "number" && Number.isFinite(patch.estimateHours) ? Math.min(2e3, Math.max(1, Math.round(patch.estimateHours))) : existing.estimateHours;
    const next = {
      id: existing.id,
      key: existing.key,
      projectId: existing.projectId,
      parentId: existing.parentId ?? null,
      type: existing.type,
      title: nextTitle,
      description: typeof patch.description === "string" ? patch.description.trim().slice(0, 8e3) : existing.description,
      status: patch.status ?? existing.status,
      priority: patch.priority ?? existing.priority,
      ownerId: patch.ownerId ?? existing.ownerId,
      assigneeIds: Array.isArray(patch.assigneeIds) ? patch.assigneeIds.filter((id) => typeof id === "string" && validUserIds.has(id)) : existing.assigneeIds,
      reviewerId: patch.reviewerId === void 0 ? existing.reviewerId : patch.reviewerId || null,
      creatorId: existing.creatorId,
      teamId: existing.teamId ?? null,
      milestoneId: patch.milestoneId === void 0 ? existing.milestoneId : patch.milestoneId || null,
      startDate: patch.startDate ?? existing.startDate,
      dueDate: patch.dueDate ?? existing.dueDate,
      estimateHours: nextEstimate,
      labels: patch.labels !== void 0 ? sanitizeLabels(patch.labels) : existing.labels,
      acceptanceCriteria: typeof patch.acceptanceCriteria === "string" ? patch.acceptanceCriteria.trim().slice(0, 4e3) : existing.acceptanceCriteria,
      dependenciesConfirmedNone: typeof patch.dependenciesConfirmedNone === "boolean" ? patch.dependenciesConfirmedNone : existing.dependenciesConfirmedNone,
      blockerReason: typeof patch.blockerReason === "string" ? patch.blockerReason.trim().slice(0, 500) : existing.blockerReason,
      blockerOwnerId: patch.blockerOwnerId === void 0 ? existing.blockerOwnerId : patch.blockerOwnerId || null,
      nextReviewDate: typeof patch.nextReviewDate === "string" ? patch.nextReviewDate : existing.nextReviewDate,
      blockerExceptionReason: typeof patch.blockerExceptionReason === "string" ? patch.blockerExceptionReason.trim().slice(0, 500) : existing.blockerExceptionReason,
      evidenceNote: typeof patch.evidenceNote === "string" ? patch.evidenceNote.trim().slice(0, 1e3) : existing.evidenceNote,
      highRisk: typeof patch.highRisk === "boolean" ? patch.highRisk : existing.highRisk,
      securityApprovedBy,
      version: existing.version + 1,
      createdAt: existing.createdAt,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      history: [...existing.history]
    };
    const gateError = validateWorkPackageTransition({ db, actor, existing, next });
    if (gateError) {
      res.status(400).json({ error: gateError });
      return;
    }
    const trackedFields = ["status", "priority", "ownerId", "dueDate", "title", "milestoneId"];
    for (const field of trackedFields) {
      if (String(existing[field] ?? "") !== String(next[field] ?? "")) {
        next.history.unshift({
          id: `hist-${crypto4.randomBytes(4).toString("hex")}`,
          field,
          oldValue: String(existing[field] ?? ""),
          newValue: String(next[field] ?? ""),
          actorId: actor.id,
          timestamp: next.updatedAt
        });
      }
    }
    db.workPackages[idx] = next;
    if (existing.status !== next.status) {
      emitActivity(db, {
        actorId: actor.id,
        action: `moved to ${next.status}`,
        resourceType: "work_package",
        resourceId: next.id,
        resourceKey: next.key,
        resourceTitle: next.title,
        projectId: next.projectId,
        summary: `Transitioned ${next.key} from ${existing.status} to ${next.status}.`
      });
      if (next.status === "In Review" && next.reviewerId) {
        emitNotification(db, {
          recipientId: next.reviewerId,
          category: "review",
          title: `Review requested on ${next.key}`,
          summary: `${actor.displayName} moved ${next.key} to In Review.`,
          resourceType: "work_package",
          resourceId: next.id,
          securityCritical: Boolean(next.highRisk)
        });
      }
      if (next.status === "Blocked" && next.blockerOwnerId) {
        emitNotification(db, {
          recipientId: next.blockerOwnerId,
          category: "blocker",
          title: `Blocker assigned on ${next.key}`,
          summary: next.blockerReason || "Work package marked Blocked.",
          resourceType: "work_package",
          resourceId: next.id,
          securityCritical: false
        });
      }
    }
    saveDb(db);
    res.json(next);
  });
  app.delete("/api/v1/work-packages/:id", requireAuth, (req, res) => {
    const actor = req.authUser;
    if (!canManageProjects(actor.role)) {
      res.status(403).json({ error: "Only Project/Programme Managers or Admins can delete work packages." });
      return;
    }
    const db = getDb();
    const wp = db.workPackages.find((w) => w.id === req.params.id);
    if (!wp) {
      res.status(404).json({ error: "Work package not found." });
      return;
    }
    const project = db.projects.find((p) => p.id === wp.projectId);
    if (!project || !canViewProject(actor, project)) {
      res.status(403).json({ error: "Access denied." });
      return;
    }
    db.workPackages = db.workPackages.filter((w) => w.id !== wp.id);
    db.dependencies = db.dependencies.filter((d) => d.predecessorId !== wp.id && d.successorId !== wp.id);
    db.comments = db.comments.filter((c) => !(c.resourceType === "work_package" && c.resourceId === wp.id));
    recordAudit({
      actorId: actor.id,
      actorName: actor.displayName,
      action: "work_package.deleted",
      targetType: "WorkPackage",
      targetId: wp.key,
      result: "success",
      details: `Deleted work package ${wp.key}: ${wp.title}.`,
      correlationId: req.correlationId
    });
    saveDb(db);
    res.json({ ok: true });
  });
  app.post("/api/v1/work-packages/:id/comments", requireAuth, (req, res) => {
    const actor = req.authUser;
    if (!canEditWork(actor.role)) {
      res.status(403).json({ error: "Read-only observers cannot post comments." });
      return;
    }
    const db = getDb();
    const wp = db.workPackages.find((w) => w.id === req.params.id);
    if (!wp) {
      res.status(404).json({ error: "Work package not found." });
      return;
    }
    const project = db.projects.find((p) => p.id === wp.projectId);
    if (!project || !canViewProject(actor, project)) {
      res.status(403).json({ error: "Access denied." });
      return;
    }
    const { body } = req.body;
    if (!body || typeof body !== "string" || !body.trim()) {
      res.status(400).json({ error: "Comment text is required." });
      return;
    }
    const cleanBody = body.trim().slice(0, 4e3);
    const mentions = db.users.filter((u) => cleanBody.toLowerCase().includes(`@${u.displayName.toLowerCase().split(" ")[0]}`)).map((u) => u.id);
    const comment = {
      id: `cmt-${crypto4.randomBytes(4).toString("hex")}`,
      resourceType: "work_package",
      resourceId: wp.id,
      authorId: actor.id,
      body: cleanBody,
      mentions,
      reactions: {},
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    db.comments.push(comment);
    for (const uid of mentions) {
      if (uid !== actor.id) {
        emitNotification(db, {
          recipientId: uid,
          category: "mention",
          title: `Mentioned in ${wp.key}`,
          summary: `${actor.displayName} mentioned you on ${wp.key}: ${wp.title}`,
          resourceType: "work_package",
          resourceId: wp.id,
          securityCritical: false
        });
      }
    }
    emitActivity(db, {
      actorId: actor.id,
      action: "commented on",
      resourceType: "work_package",
      resourceId: wp.id,
      resourceKey: wp.key,
      resourceTitle: wp.title,
      projectId: wp.projectId,
      summary: comment.body.slice(0, 120)
    });
    saveDb(db);
    res.status(201).json(comment);
  });
  app.post("/api/v1/comments/:id/react", requireAuth, (req, res) => {
    const actor = req.authUser;
    const db = getDb();
    const comment = db.comments.find((c) => c.id === req.params.id);
    if (!comment) {
      res.status(404).json({ error: "Comment not found." });
      return;
    }
    const { label } = req.body;
    const cleanLabel = typeof label === "string" && ["ACK", "+1", "Verified"].includes(label) ? label : "+1";
    const current = comment.reactions[cleanLabel] || [];
    if (current.includes(actor.id)) {
      comment.reactions[cleanLabel] = current.filter((id) => id !== actor.id);
    } else {
      comment.reactions[cleanLabel] = [...current, actor.id];
    }
    saveDb(db);
    res.json(comment);
  });
  app.post("/api/v1/dependencies", requireAuth, (req, res) => {
    const actor = req.authUser;
    if (!canEditWork(actor.role)) {
      res.status(403).json({ error: "Insufficient permissions." });
      return;
    }
    const { predecessorId, successorId, type } = req.body;
    if (!predecessorId || !successorId) {
      res.status(400).json({ error: "predecessorId and successorId are required." });
      return;
    }
    const db = getDb();
    const pred = db.workPackages.find((w) => w.id === predecessorId);
    const succ = db.workPackages.find((w) => w.id === successorId);
    if (!pred || !succ) {
      res.status(404).json({ error: "Referenced work package not found." });
      return;
    }
    const predProj = db.projects.find((p) => p.id === pred.projectId);
    const succProj = db.projects.find((p) => p.id === succ.projectId);
    if (!predProj || !succProj || !canViewProject(actor, predProj) || !canViewProject(actor, succProj)) {
      res.status(403).json({ error: "Access denied to referenced projects." });
      return;
    }
    if (db.dependencies.some((d) => d.predecessorId === predecessorId && d.successorId === successorId)) {
      res.status(409).json({ error: "Dependency edge already exists." });
      return;
    }
    const cycle = detectDependencyCycle(db.dependencies, predecessorId, successorId);
    if (cycle) {
      const cycleKeys = cycle.map((id) => db.workPackages.find((w) => w.id === id)?.key || id);
      res.status(400).json({
        error: `Dependency cycle rejected: ${cycleKeys.join(" -> ")}`
      });
      return;
    }
    const dep = {
      id: `dep-${crypto4.randomBytes(4).toString("hex")}`,
      predecessorId,
      successorId,
      type: type === "relates_to" ? "relates_to" : "blocks"
    };
    db.dependencies.push(dep);
    saveDb(db);
    res.status(201).json(dep);
  });
  app.delete("/api/v1/dependencies/:id", requireAuth, (req, res) => {
    const actor = req.authUser;
    if (!canEditWork(actor.role)) {
      res.status(403).json({ error: "Insufficient permissions." });
      return;
    }
    const db = getDb();
    const dep = db.dependencies.find((d) => d.id === req.params.id);
    if (!dep) {
      res.status(404).json({ error: "Dependency not found." });
      return;
    }
    const succ = db.workPackages.find((w) => w.id === dep.successorId);
    const proj = succ ? db.projects.find((p) => p.id === succ.projectId) : void 0;
    if (proj && !canViewProject(actor, proj)) {
      res.status(403).json({ error: "Access denied." });
      return;
    }
    db.dependencies = db.dependencies.filter((d) => d.id !== req.params.id);
    saveDb(db);
    res.json({ ok: true });
  });
  app.post("/api/v1/milestones", requireAuth, (req, res) => {
    const actor = req.authUser;
    if (!canManageProjects(actor.role)) {
      res.status(403).json({ error: "Only Project/Programme Managers or Admins can create milestones." });
      return;
    }
    if (containsOperatorConsoleViolation(req.body)) {
      res.status(403).json({ error: "Trust boundary violation." });
      return;
    }
    const body = req.body;
    if (!body.projectId || typeof body.title !== "string" || !body.title.trim() || !isValidIsoDate(body.targetDate)) {
      res.status(400).json({ error: "projectId, title, and valid targetDate (YYYY-MM-DD) are required." });
      return;
    }
    const db = getDb();
    const proj = db.projects.find((p) => p.id === body.projectId);
    if (!proj || !canViewProject(actor, proj)) {
      res.status(404).json({ error: "Target project not found or access denied." });
      return;
    }
    const conf = Number(body.confidence);
    const milestone = {
      id: `ms-${crypto4.randomBytes(4).toString("hex")}`,
      projectId: body.projectId,
      title: body.title.trim().slice(0, 140),
      targetWindow: typeof body.targetWindow === "string" && body.targetWindow.trim() ? body.targetWindow.trim().slice(0, 32) : body.targetDate.slice(0, 7),
      targetDate: body.targetDate,
      state: body.state && ALLOWED_MILESTONE_STATE.has(body.state) ? body.state : "Planned",
      confidence: Number.isFinite(conf) ? Math.min(100, Math.max(0, Math.round(conf))) : 80,
      ownerId: typeof body.ownerId === "string" && db.users.some((u) => u.id === body.ownerId) ? body.ownerId : actor.id,
      description: typeof body.description === "string" ? body.description.trim().slice(0, 500) : ""
    };
    db.milestones.push(milestone);
    emitActivity(db, {
      actorId: actor.id,
      action: "created milestone",
      resourceType: "milestone",
      resourceId: milestone.id,
      resourceTitle: milestone.title,
      projectId: milestone.projectId,
      summary: `Target ${milestone.targetDate} (${milestone.confidence}% confidence).`
    });
    saveDb(db);
    res.status(201).json(milestone);
  });
  app.patch("/api/v1/milestones/:id", requireAuth, (req, res) => {
    const actor = req.authUser;
    if (!canManageProjects(actor.role)) {
      res.status(403).json({ error: "Only Project/Programme Managers or Admins can update milestones." });
      return;
    }
    const db = getDb();
    const ms = db.milestones.find((m) => m.id === req.params.id);
    if (!ms) {
      res.status(404).json({ error: "Milestone not found." });
      return;
    }
    const proj = db.projects.find((p) => p.id === ms.projectId);
    if (!proj || !canViewProject(actor, proj)) {
      res.status(403).json({ error: "Access denied." });
      return;
    }
    const patch = req.body;
    if (typeof patch.title === "string" && patch.title.trim())
      ms.title = patch.title.trim().slice(0, 140);
    if (isValidIsoDate(patch.targetDate))
      ms.targetDate = patch.targetDate;
    if (patch.state !== void 0) {
      if (!ALLOWED_MILESTONE_STATE.has(patch.state)) {
        res.status(400).json({ error: "Invalid milestone state." });
        return;
      }
      ms.state = patch.state;
    }
    if (typeof patch.confidence === "number" && Number.isFinite(patch.confidence)) {
      ms.confidence = Math.min(100, Math.max(0, Math.round(patch.confidence)));
    }
    if (typeof patch.description === "string")
      ms.description = patch.description.trim().slice(0, 500);
    saveDb(db);
    res.json(ms);
  });
  app.post("/api/v1/documents", requireAuth, (req, res) => {
    const actor = req.authUser;
    if (!canEditWork(actor.role)) {
      res.status(403).json({ error: "Read-only observers cannot author documents." });
      return;
    }
    if (containsOperatorConsoleViolation(req.body)) {
      res.status(403).json({ error: "Trust boundary violation." });
      return;
    }
    const body = req.body;
    if (typeof body.title !== "string" || !body.title.trim() || typeof body.body !== "string" || !body.body.trim()) {
      res.status(400).json({ error: "Document title and body are required." });
      return;
    }
    const db = getDb();
    if (body.projectId) {
      const proj = db.projects.find((p) => p.id === body.projectId);
      if (!proj || !canViewProject(actor, proj)) {
        res.status(403).json({ error: "Target project not found or access denied." });
        return;
      }
    }
    const category = body.category && ALLOWED_DOC_CATEGORIES.has(body.category) ? body.category : "Specification";
    const status = body.status && ALLOWED_DOC_STATUS.has(body.status) ? body.status : "Draft";
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const slugBase = body.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "doc";
    const validWpIds = new Set(db.workPackages.map((w) => w.id));
    const linkedWorkIds = Array.isArray(body.linkedWorkIds) ? body.linkedWorkIds.filter((id) => typeof id === "string" && validWpIds.has(id)) : [];
    const doc = {
      id: `doc-${crypto4.randomBytes(4).toString("hex")}`,
      slug: `${slugBase}-${crypto4.randomBytes(2).toString("hex")}`,
      projectId: body.projectId || null,
      category,
      title: body.title.trim().slice(0, 180),
      body: body.body.slice(0, 5e4),
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
          body: body.body.slice(0, 5e4),
          editorId: actor.id,
          summary: "Initial version",
          createdAt: now
        }
      ]
    };
    db.documents.unshift(doc);
    emitActivity(db, {
      actorId: actor.id,
      action: "published",
      resourceType: "document",
      resourceId: doc.id,
      resourceKey: doc.category,
      resourceTitle: doc.title,
      projectId: doc.projectId || void 0,
      summary: `Created ${doc.category} v1.`
    });
    saveDb(db);
    res.status(201).json(doc);
  });
  app.patch("/api/v1/documents/:id", requireAuth, (req, res) => {
    const actor = req.authUser;
    if (!canEditWork(actor.role)) {
      res.status(403).json({ error: "Read-only observers cannot edit documents." });
      return;
    }
    if (containsOperatorConsoleViolation(req.body)) {
      res.status(403).json({ error: "Trust boundary violation." });
      return;
    }
    const db = getDb();
    const doc = db.documents.find((d) => d.id === req.params.id);
    if (!doc || !canViewDocument(actor, doc, db.projects)) {
      res.status(404).json({ error: "Document not found or access denied." });
      return;
    }
    const { title, body, status, summary, version, restricted, linkedWorkIds } = req.body;
    if (typeof version === "number" && version !== doc.version) {
      res.status(409).json({
        error: `Document version conflict: server is at v${doc.version}.`
      });
      return;
    }
    if (status !== void 0 && !ALLOWED_DOC_STATUS.has(status)) {
      res.status(400).json({ error: "Invalid document status." });
      return;
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    if (typeof title === "string" && title.trim())
      doc.title = title.trim().slice(0, 180);
    if (status)
      doc.status = status;
    if (typeof restricted === "boolean")
      doc.restricted = restricted;
    if (Array.isArray(linkedWorkIds)) {
      const validWpIds = new Set(db.workPackages.map((w) => w.id));
      doc.linkedWorkIds = linkedWorkIds.filter((id) => typeof id === "string" && validWpIds.has(id));
    }
    if (typeof body === "string" && body !== doc.body) {
      doc.body = body.slice(0, 5e4);
      doc.version += 1;
      doc.versions.push({
        version: doc.version,
        body: doc.body,
        editorId: actor.id,
        summary: typeof summary === "string" && summary.trim() ? summary.trim().slice(0, 200) : `Updated to v${doc.version}`,
        createdAt: now
      });
    }
    doc.updatedAt = now;
    if (doc.restricted) {
      recordAudit({
        actorId: actor.id,
        actorName: actor.displayName,
        action: "document.restricted_updated",
        targetType: "Document",
        targetId: doc.id,
        result: "success",
        details: `Updated restricted document ${doc.title} to v${doc.version}.`,
        correlationId: req.correlationId
      });
    }
    saveDb(db);
    res.json(doc);
  });
  app.post("/api/v1/documents/:id/comments", requireAuth, (req, res) => {
    const actor = req.authUser;
    if (!canEditWork(actor.role)) {
      res.status(403).json({ error: "Read-only observers cannot post comments." });
      return;
    }
    const db = getDb();
    const doc = db.documents.find((d) => d.id === req.params.id);
    if (!doc || !canViewDocument(actor, doc, db.projects)) {
      res.status(404).json({ error: "Document not found or access denied." });
      return;
    }
    const { body } = req.body;
    if (!body || typeof body !== "string" || !body.trim()) {
      res.status(400).json({ error: "Comment text is required." });
      return;
    }
    const cleanBody = body.trim().slice(0, 4e3);
    const mentions = db.users.filter((u) => cleanBody.toLowerCase().includes(`@${u.displayName.toLowerCase().split(" ")[0]}`)).map((u) => u.id);
    const comment = {
      id: `cmt-${crypto4.randomBytes(4).toString("hex")}`,
      resourceType: "document",
      resourceId: doc.id,
      authorId: actor.id,
      body: cleanBody,
      mentions,
      reactions: {},
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    db.comments.push(comment);
    saveDb(db);
    res.status(201).json(comment);
  });
  app.post("/api/v1/meetings", requireAuth, (req, res) => {
    const actor = req.authUser;
    if (!canEditWork(actor.role)) {
      res.status(403).json({ error: "Insufficient permissions to schedule meetings." });
      return;
    }
    if (containsOperatorConsoleViolation(req.body)) {
      res.status(403).json({ error: "Trust boundary violation." });
      return;
    }
    const body = req.body;
    if (typeof body.title !== "string" || !body.title.trim() || !isValidIsoDate(body.date)) {
      res.status(400).json({ error: "Meeting title and valid date (YYYY-MM-DD) are required." });
      return;
    }
    const db = getDb();
    if (body.projectId) {
      const proj = db.projects.find((p) => p.id === body.projectId);
      if (!proj || !canViewProject(actor, proj)) {
        res.status(403).json({ error: "Target project not found or access denied." });
        return;
      }
    }
    const meeting = {
      id: `mtg-${crypto4.randomBytes(4).toString("hex")}`,
      projectId: body.projectId || null,
      title: body.title.trim().slice(0, 140),
      date: body.date,
      timeRange: typeof body.timeRange === "string" && body.timeRange.trim() ? body.timeRange.trim().slice(0, 40) : "15:00 \u2013 15:45 UTC",
      facilitatorId: typeof body.facilitatorId === "string" && db.users.some((u) => u.id === body.facilitatorId) ? body.facilitatorId : actor.id,
      channelRef: typeof body.channelRef === "string" && body.channelRef.trim() ? body.channelRef.trim().slice(0, 48) : "#ctrl-plane-dev",
      agendaSummary: typeof body.agendaSummary === "string" ? body.agendaSummary.trim().slice(0, 500) : ""
    };
    db.meetings.unshift(meeting);
    saveDb(db);
    res.status(201).json(meeting);
  });
  app.post("/api/v1/attachments", requireAuth, (req, res) => {
    const actor = req.authUser;
    if (!canEditWork(actor.role)) {
      res.status(403).json({ error: "Insufficient permissions." });
      return;
    }
    const { parentType, parentId, projectId, fileName, mediaType, contentBase64 } = req.body;
    if (parentType !== "work_package" && parentType !== "document" || !parentId || !projectId || !fileName || !mediaType || !contentBase64) {
      res.status(400).json({ error: "Missing required attachment fields." });
      return;
    }
    if (!ALLOWED_UPLOAD_MIME.has(mediaType)) {
      res.status(400).json({ error: `Unsupported media type: ${mediaType}` });
      return;
    }
    const db = getDb();
    const project = db.projects.find((p) => p.id === projectId);
    if (!project || !canViewProject(actor, project)) {
      res.status(403).json({ error: "Access denied to target project." });
      return;
    }
    if (parentType === "work_package") {
      const wp = db.workPackages.find((w) => w.id === parentId && w.projectId === project.id);
      if (!wp) {
        res.status(404).json({ error: "Referenced work package not found in project." });
        return;
      }
    } else {
      const doc = db.documents.find((d) => d.id === parentId);
      if (!doc || !canViewDocument(actor, doc, db.projects)) {
        res.status(403).json({ error: "Referenced document not found or access denied." });
        return;
      }
    }
    const normalizedBase64 = contentBase64.replace(/\s+/g, "");
    if (!/^[A-Za-z0-9+/=]+$/.test(normalizedBase64)) {
      res.status(400).json({ error: "Invalid base64 attachment payload." });
      return;
    }
    const buffer = Buffer.from(normalizedBase64, "base64");
    if (buffer.byteLength === 0) {
      res.status(400).json({ error: "Empty attachment uploads are not permitted." });
      return;
    }
    if (buffer.byteLength > 2 * 1024 * 1024) {
      res.status(400).json({ error: "Attachment exceeds 2 MB limit." });
      return;
    }
    if (mediaType === "image/svg+xml" && !isSafeSvgContent(buffer)) {
      res.status(400).json({ error: "Rejected SVG containing active scripting or unsafe elements." });
      return;
    }
    const safeName = sanitizeHeaderFilename(fileName);
    const storageKey = `${crypto4.randomBytes(8).toString("hex")}-${safeName}`;
    const resolvedTarget = path3.resolve(ATTACHMENTS_DIR, storageKey);
    if (!resolvedTarget.startsWith(ATTACHMENTS_DIR + path3.sep)) {
      res.status(400).json({ error: "Invalid file path." });
      return;
    }
    fs3.writeFileSync(resolvedTarget, buffer);
    const checksumSha256 = crypto4.createHash("sha256").update(buffer).digest("hex");
    const att = {
      id: `att-${crypto4.randomBytes(4).toString("hex")}`,
      parentType,
      parentId,
      projectId,
      fileName: safeName,
      mediaType,
      sizeBytes: buffer.byteLength,
      checksumSha256,
      uploadedBy: actor.id,
      uploadedAt: (/* @__PURE__ */ new Date()).toISOString(),
      storageKey
    };
    db.attachments.push(att);
    saveDb(db);
    res.status(201).json(att);
  });
  app.get("/api/v1/attachments/:id/download", requireAuth, (req, res) => {
    const actor = req.authUser;
    const db = getDb();
    const att = db.attachments.find((a) => a.id === req.params.id);
    if (!att) {
      res.status(404).json({ error: "Attachment not found." });
      return;
    }
    const project = db.projects.find((p) => p.id === att.projectId);
    const docAllowed = att.parentType !== "document" || (() => {
      const doc = db.documents.find((d) => d.id === att.parentId);
      return Boolean(doc && canViewDocument(actor, doc, db.projects));
    })();
    if (!project || !canViewProject(actor, project) || !docAllowed) {
      recordAudit({
        actorId: actor.id,
        actorName: actor.displayName,
        action: "file.download_denied",
        targetType: "Attachment",
        targetId: att.id,
        result: "denied",
        details: "Denied cross-project or unauthorized attachment download.",
        correlationId: req.correlationId
      });
      res.status(403).json({ error: "Access denied to attachment." });
      return;
    }
    const resolvedTarget = path3.resolve(ATTACHMENTS_DIR, att.storageKey);
    if (!resolvedTarget.startsWith(ATTACHMENTS_DIR + path3.sep) || !fs3.existsSync(resolvedTarget)) {
      res.status(404).json({ error: "Attachment bytes unavailable." });
      return;
    }
    const safeDownloadName = sanitizeHeaderFilename(att.fileName);
    res.setHeader("Content-Type", att.mediaType);
    res.setHeader("Content-Disposition", `attachment; filename="${safeDownloadName}"`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "sandbox; default-src 'none'");
    res.sendFile(resolvedTarget);
  });
  app.post("/api/v1/members/invite", requireAuth, (req, res) => {
    const actor = req.authUser;
    if (!isWorkspaceAdmin(actor.role)) {
      res.status(403).json({ error: "Only Workspace Owners or Administrators may invite members." });
      return;
    }
    if (containsOperatorConsoleViolation(req.body)) {
      recordAudit({
        actorId: actor.id,
        actorName: actor.displayName,
        action: "security.operator_boundary_violation",
        targetType: "Member",
        targetId: "invite",
        result: "denied",
        details: "Blocked attempt to create a production operator console seat from Engineering Workspace.",
        correlationId: req.correlationId
      });
      res.status(403).json({
        error: "Trust boundary violation: Engineering Workspace cannot issue or manage the 8 Production Operator Console seats."
      });
      return;
    }
    const { email, displayName, title, role, expiresAt } = req.body;
    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || !displayName?.trim() || !role || !ALLOWED_ROLES.includes(role)) {
      res.status(400).json({ error: "Valid email, displayName, and workspace role are required." });
      return;
    }
    if (role === "Workspace Owner" && actor.role !== "Workspace Owner") {
      res.status(403).json({ error: "Only an existing Workspace Owner can invite another Workspace Owner." });
      return;
    }
    const db = getDb();
    const slotsUsed = getActiveSlotCount(db);
    if (slotsUsed >= MAX_ACCOUNT_SLOTS) {
      res.status(409).json({
        error: `Account limit reached (${slotsUsed}/${MAX_ACCOUNT_SLOTS} slots occupied). Remove or revoke an existing account to free a slot.`
      });
      return;
    }
    if (db.users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase())) {
      res.status(409).json({ error: "Member email already exists in workspace." });
      return;
    }
    const newUserId = `usr-${crypto4.randomBytes(4).toString("hex")}`;
    const newUser = {
      id: newUserId,
      idpSubject: `invite|trv-${crypto4.randomBytes(3).toString("hex")}`,
      authProvider: "firebase",
      displayName: displayName.trim().slice(0, 80),
      email: email.trim().toLowerCase(),
      title: title?.trim().slice(0, 80) || "Engineer",
      role,
      state: "invited",
      mfaEnabled: true,
      timezone: "UTC",
      joinedAt: (/* @__PURE__ */ new Date()).toISOString(),
      expiresAt: expiresAt && !Number.isNaN(Date.parse(expiresAt)) ? expiresAt : null,
      presence: "away",
      chatNotificationMode: "mentions_only",
      notifyOnChannelAll: true,
      desktopAlerts: false,
      channelNotificationModes: {}
    };
    const rawToken = `trv-inv-${crypto4.randomBytes(16).toString("hex")}`;
    const tokenHash = crypto4.createHash("sha256").update(rawToken).digest("hex");
    db.users.push(newUser);
    db.invites.push({
      id: `inv-${crypto4.randomBytes(4).toString("hex")}`,
      email: newUser.email,
      displayName: newUser.displayName,
      role,
      title: newUser.title,
      tokenHash,
      invitedBy: actor.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1e3).toISOString(),
      acceptedAt: null
    });
    saveDb(db);
    recordAudit({
      actorId: actor.id,
      actorName: actor.displayName,
      action: "member.invited",
      targetType: "User",
      targetId: newUser.id,
      result: "success",
      details: `Invited ${newUser.email} as ${role} (slot ${getActiveSlotCount(db)}/${MAX_ACCOUNT_SLOTS}).`,
      correlationId: req.correlationId
    });
    res.status(201).json({ user: sanitizeUser(newUser, db), inviteToken: rawToken });
  });
  app.delete("/api/v1/members/:id", requireAuth, (req, res) => {
    const actor = req.authUser;
    if (!isWorkspaceAdmin(actor.role)) {
      res.status(403).json({ error: "Only Workspace Owners or Administrators may remove members." });
      return;
    }
    const db = getDb();
    const target = db.users.find((u) => u.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: "Member not found." });
      return;
    }
    if (target.id === actor.id) {
      res.status(400).json({ error: "Cannot remove your own active workspace account." });
      return;
    }
    const activeOwners = db.users.filter((u) => u.role === "Workspace Owner" && u.state === "active");
    if (target.role === "Workspace Owner" && (actor.role !== "Workspace Owner" || activeOwners.length <= 1)) {
      res.status(403).json({ error: "Cannot remove a Workspace Owner unless another active Workspace Owner exists." });
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
      action: "member.removed",
      targetType: "User",
      targetId: target.id,
      result: "success",
      details: `Removed ${target.email} and released account slot (${getActiveSlotCount(db)}/${MAX_ACCOUNT_SLOTS} used).`,
      correlationId: req.correlationId
    });
    res.json({ ok: true, slotsUsed: getActiveSlotCount(db), maxSlots: MAX_ACCOUNT_SLOTS });
  });
  app.patch("/api/v1/members/:id", requireAuth, (req, res) => {
    const actor = req.authUser;
    if (!isWorkspaceAdmin(actor.role)) {
      res.status(403).json({ error: "Only Workspace Owners or Administrators may alter member roles or state." });
      return;
    }
    if (containsOperatorConsoleViolation(req.body)) {
      recordAudit({
        actorId: actor.id,
        actorName: actor.displayName,
        action: "security.operator_boundary_violation",
        targetType: "User",
        targetId: req.params.id,
        result: "denied",
        details: "Rejected payload attempting to grant production operator privileges.",
        correlationId: req.correlationId
      });
      res.status(403).json({
        error: "Prohibited: Workspace administrators cannot grant Production Operator Console privileges."
      });
      return;
    }
    const db = getDb();
    const target = db.users.find((u) => u.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: "Member not found." });
      return;
    }
    const { role, state, expiresAt } = req.body;
    const activeOwners = db.users.filter((u) => u.role === "Workspace Owner" && u.state === "active");
    if (role) {
      if (!ALLOWED_ROLES.includes(role)) {
        res.status(400).json({ error: "Invalid workspace role." });
        return;
      }
      if ((role === "Workspace Owner" || target.role === "Workspace Owner") && actor.role !== "Workspace Owner") {
        res.status(403).json({ error: "Only an existing Workspace Owner can alter Workspace Owner assignments." });
        return;
      }
      if (target.role === "Workspace Owner" && role !== "Workspace Owner" && activeOwners.length <= 1) {
        res.status(400).json({ error: "Cannot demote the sole active Workspace Owner." });
        return;
      }
      const prevRole = target.role;
      target.role = role;
      invalidateUserSessions(target.id);
      recordAudit({
        actorId: actor.id,
        actorName: actor.displayName,
        action: "member.role_changed",
        targetType: "User",
        targetId: target.id,
        result: "success",
        details: `Changed ${target.displayName} role from ${prevRole} to ${role}.`,
        correlationId: req.correlationId
      });
    }
    if (state) {
      if (!ALLOWED_MEMBER_STATES.has(state)) {
        res.status(400).json({ error: "Invalid member state." });
        return;
      }
      if (target.id === actor.id && state !== "active") {
        res.status(400).json({ error: "Cannot suspend or revoke your own active session." });
        return;
      }
      if (target.role === "Workspace Owner" && state !== "active" && activeOwners.length <= 1) {
        res.status(400).json({ error: "Cannot suspend or revoke the sole active Workspace Owner." });
        return;
      }
      const prevState = target.state;
      target.state = state;
      if (state !== "active") {
        invalidateUserSessions(target.id);
      }
      recordAudit({
        actorId: actor.id,
        actorName: actor.displayName,
        action: `member.state_${state}`,
        targetType: "User",
        targetId: target.id,
        result: "success",
        details: `Changed ${target.displayName} state from ${prevState} to ${state}.`,
        correlationId: req.correlationId
      });
      emitNotification(db, {
        recipientId: actor.id,
        category: "access",
        title: `Member access updated: ${target.displayName}`,
        summary: `Account state set to ${state}.`,
        resourceType: "member",
        resourceId: target.id,
        securityCritical: true
      });
    }
    if (expiresAt !== void 0) {
      target.expiresAt = expiresAt;
    }
    saveDb(db);
    res.json(sanitizeUser(target, db));
  });
  app.post("/api/v1/members/:id/keyfile", requireAuth, (req, res) => {
    const actor = req.authUser;
    if (!isWorkspaceAdmin(actor.role)) {
      res.status(403).json({ error: "Only Workspace Owners or Administrators may issue account key files." });
      return;
    }
    const db = getDb();
    const target = db.users.find((u) => u.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: "Member not found." });
      return;
    }
    if (target.role === "Workspace Owner" && actor.role !== "Workspace Owner") {
      res.status(403).json({ error: "Only a Workspace Owner can issue or rotate a Workspace Owner key file." });
      return;
    }
    const keyId = `trv-key-${crypto4.randomBytes(4).toString("hex")}`;
    const secret = crypto4.randomBytes(32).toString("hex");
    const issuedAt = (/* @__PURE__ */ new Date()).toISOString();
    const keyData = {
      product: "truvornex",
      keyId,
      email: target.email,
      issuedAt,
      secret
    };
    db.userKeyfileHashes = db.userKeyfileHashes || {};
    db.userKeyfileHashes[target.id] = {
      hash: sha256Hex(secret),
      keyId,
      issuedAt
    };
    saveDb(db);
    if (target.id !== actor.id) {
      invalidateUserSessions(target.id);
    }
    recordAudit({
      actorId: actor.id,
      actorName: actor.displayName,
      action: "member.keyfile_issued",
      targetType: "User",
      targetId: target.id,
      result: "success",
      details: `Issued JSON access keyfile (${keyId}) for ${target.email}.`,
      correlationId: req.correlationId
    });
    const emailSlug = target.email.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || target.id;
    res.json({
      filename: `${emailSlug}-key.json`,
      keyId,
      issuedAt,
      keyData,
      user: sanitizeUser(target, db)
    });
  });
  app.post("/api/v1/notifications/:id/read", requireAuth, (req, res) => {
    const db = getDb();
    const user = req.authUser;
    const notif = db.notifications.find((n) => n.id === req.params.id);
    if (notif && (notif.recipientId === user.id || isWorkspaceAdmin(user.role))) {
      notif.read = true;
      saveDb(db);
    }
    res.json({ ok: true });
  });
  app.post("/api/v1/notifications/read-all", requireAuth, (req, res) => {
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
  app.patch("/api/v1/integrations/:id", requireAuth, (req, res) => {
    const actor = req.authUser;
    if (!isWorkspaceAdmin(actor.role)) {
      res.status(403).json({ error: "Only Workspace Owners or Administrators may manage integrations." });
      return;
    }
    if (containsOperatorConsoleViolation(req.body)) {
      res.status(403).json({ error: "Trust boundary violation." });
      return;
    }
    const db = getDb();
    const integration = db.integrations.find((i) => i.id === req.params.id);
    if (!integration) {
      res.status(404).json({ error: "Integration not found." });
      return;
    }
    const { enabled, rotateSecret } = req.body;
    if (typeof enabled === "boolean") {
      integration.enabled = enabled;
      integration.status = enabled ? "Connected" : "Disabled";
    }
    if (rotateSecret === true) {
      integration.secretRef = `vault://truvornex/integrations/${integration.provider}-rot-${crypto4.randomBytes(2).toString("hex")}`;
      integration.lastSyncAt = (/* @__PURE__ */ new Date()).toISOString();
    }
    saveDb(db);
    recordAudit({
      actorId: actor.id,
      actorName: actor.displayName,
      action: rotateSecret ? "integration.secret_rotated" : "integration.state_changed",
      targetType: "Integration",
      targetId: integration.id,
      result: "success",
      details: `${integration.name} status=${integration.status}.`,
      correlationId: req.correlationId
    });
    res.json(integration);
  });
  app.post("/api/v1/integrations/:id/test-webhook", requireAuth, (req, res) => {
    const actor = req.authUser;
    if (!isWorkspaceAdmin(actor.role)) {
      res.status(403).json({ error: "Admin access required." });
      return;
    }
    const db = getDb();
    const integration = db.integrations.find((i) => i.id === req.params.id);
    if (!integration) {
      res.status(404).json({ error: "Integration not found." });
      return;
    }
    const { simulateInvalidSignature, deliveryId } = req.body;
    const dId = typeof deliveryId === "string" && deliveryId.trim() ? deliveryId.trim().slice(0, 64) : `dlv-${crypto4.randomBytes(4).toString("hex")}`;
    if (simulateInvalidSignature) {
      recordAudit({
        actorId: actor.id,
        actorName: actor.displayName,
        action: "webhook.signature_rejected",
        targetType: "Integration",
        targetId: integration.id,
        result: "denied",
        details: `Rejected webhook delivery ${dId} due to invalid HMAC signature.`,
        correlationId: req.correlationId
      });
      res.status(401).json({ error: "Invalid webhook HMAC signature rejected.", deliveryId: dId });
      return;
    }
    if (db.processedWebhooks.some((w) => w.provider === integration.provider && w.deliveryId === dId)) {
      res.json({ ok: true, idempotentDuplicate: true, deliveryId: dId, message: "Duplicate delivery ignored idempotently." });
      return;
    }
    db.processedWebhooks.push({
      id: `wh-${crypto4.randomBytes(4).toString("hex")}`,
      provider: integration.provider,
      deliveryId: dId,
      receivedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    integration.lastSyncAt = (/* @__PURE__ */ new Date()).toISOString();
    saveDb(db);
    recordAudit({
      actorId: actor.id,
      actorName: actor.displayName,
      action: "webhook.verified_processed",
      targetType: "Integration",
      targetId: integration.id,
      result: "success",
      details: `Processed verified webhook delivery ${dId}.`,
      correlationId: req.correlationId
    });
    res.json({ ok: true, idempotentDuplicate: false, deliveryId: dId, message: "Webhook signature verified and recorded." });
  });
  app.patch("/api/v1/workspace", requireAuth, (req, res) => {
    const actor = req.authUser;
    if (!isWorkspaceAdmin(actor.role)) {
      res.status(403).json({ error: "Admin access required." });
      return;
    }
    if (containsOperatorConsoleViolation(req.body)) {
      res.status(403).json({ error: "Operator console trust boundary cannot be disabled." });
      return;
    }
    const db = getDb();
    const { programmeTitle, defaultTimezone, notificationPrefs } = req.body;
    if (typeof programmeTitle === "string" && programmeTitle.trim()) {
      db.workspace.programmeTitle = programmeTitle.trim().slice(0, 120);
    }
    if (typeof defaultTimezone === "string" && defaultTimezone.trim()) {
      db.workspace.defaultTimezone = defaultTimezone.trim().slice(0, 64);
    }
    if (notificationPrefs && typeof notificationPrefs === "object") {
      if (typeof notificationPrefs.batchLowPriority === "boolean") {
        db.workspace.notificationPrefs.batchLowPriority = notificationPrefs.batchLowPriority;
      }
      if (typeof notificationPrefs.emailDigest === "boolean") {
        db.workspace.notificationPrefs.emailDigest = notificationPrefs.emailDigest;
      }
      if (typeof notificationPrefs.chatDeepLinks === "boolean") {
        db.workspace.notificationPrefs.chatDeepLinks = notificationPrefs.chatDeepLinks;
      }
    }
    saveDb(db);
    recordAudit({
      actorId: actor.id,
      actorName: actor.displayName,
      action: "workspace.settings_updated",
      targetType: "Workspace",
      targetId: db.workspace.id,
      result: "success",
      details: "Updated workspace preferences.",
      correlationId: req.correlationId
    });
    res.json(db.workspace);
  });
  app.get("/api/v1/audit/export", requireAuth, (req, res) => {
    const actor = req.authUser;
    if (!isWorkspaceAdmin(actor.role) && actor.role !== "Programme Manager") {
      res.status(403).json({ error: "Only Workspace Admins or Programme Managers can export audit logs." });
      return;
    }
    const db = getDb();
    recordAudit({
      actorId: actor.id,
      actorName: actor.displayName,
      action: "audit.exported",
      targetType: "AuditLog",
      targetId: db.workspace.id,
      result: "success",
      details: `Exported ${db.auditEvents.length} audit events.`,
      correlationId: req.correlationId
    });
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", 'attachment; filename="truvornex-audit-log.json"');
    res.send(JSON.stringify(db.auditEvents, null, 2));
  });
  app.post("/api/v1/saved-views", requireAuth, (req, res) => {
    const actor = req.authUser;
    if (containsOperatorConsoleViolation(req.body)) {
      res.status(403).json({ error: "Trust boundary violation." });
      return;
    }
    const { name, filters } = req.body;
    if (typeof name !== "string" || !name.trim()) {
      res.status(400).json({ error: "View name is required." });
      return;
    }
    const db = getDb();
    const safeFilters = {};
    if (filters && typeof filters === "object") {
      if (Array.isArray(filters.status)) {
        safeFilters.status = filters.status.filter((s) => typeof s === "string" && WORK_PACKAGE_STATUSES.has(s));
      }
      if (Array.isArray(filters.priority)) {
        safeFilters.priority = filters.priority.filter((p) => typeof p === "string" && PRIORITIES.has(p));
      }
      if (typeof filters.onlyBlocked === "boolean") {
        safeFilters.onlyBlocked = filters.onlyBlocked;
      }
    }
    const view = {
      id: `view-${crypto4.randomBytes(4).toString("hex")}`,
      name: name.trim().slice(0, 60),
      ownerId: actor.id,
      scope: "workspace",
      filters: safeFilters
    };
    db.savedViews.push(view);
    saveDb(db);
    res.status(201).json(view);
  });
  app.delete("/api/v1/saved-views/:id", requireAuth, (req, res) => {
    const actor = req.authUser;
    const db = getDb();
    const view = db.savedViews.find((v) => v.id === req.params.id);
    if (!view) {
      res.status(404).json({ error: "Saved view not found." });
      return;
    }
    if (view.ownerId !== actor.id && !isWorkspaceAdmin(actor.role)) {
      res.status(403).json({ error: "Only the view creator or an administrator can delete this saved view." });
      return;
    }
    db.savedViews = db.savedViews.filter((v) => v.id !== req.params.id);
    saveDb(db);
    res.json({ ok: true });
  });
  const isServerless = Boolean(process.env.VERCEL || process.env.VERCEL_ENV || process.env.AWS_LAMBDA_FUNCTION_NAME);
  if (!IS_PROD && !isServerless) {
    const viteModule = "vite";
    const { createServer: createViteServer } = await import(
      /* @vite-ignore */
      viteModule
    );
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else if (!isServerless) {
    const distDir = path3.resolve(process.cwd(), "dist");
    app.use(express.static(distDir));
    app.get("*", (_req, res) => {
      res.sendFile(path3.join(distDir, "index.html"));
    });
  }
  app.use((err, req, res, _next) => {
    const correlationId = req.correlationId;
    if (err instanceof SyntaxError && "body" in err) {
      res.status(400).json({ error: "Invalid JSON request body.", correlationId });
      return;
    }
    console.error("Unhandled workspace error:", err);
    res.status(500).json({ error: "An internal server error occurred.", correlationId });
  });
  return app;
}
if (!process.env.VERCEL && !process.env.VERCEL_ENV && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  createWorkspaceApp().then((app) => {
    const server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`Truvornex Engineering Workspace running on http://0.0.0.0:${PORT}`);
    });
    const shutdown = () => {
      server.close(() => {
        process.exit(0);
      });
      setTimeout(() => process.exit(0), 5e3).unref();
    };
    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  }).catch((err) => {
    console.error("Failed to start Truvornex server:", err);
    process.exit(1);
  });
}

// src/server/vercel-entry.ts
var appPromise = null;
async function handler(req, res) {
  try {
    if (!appPromise) {
      appPromise = createWorkspaceApp();
    }
    const app = await appPromise;
    await new Promise((resolve) => {
      let settled = false;
      const done = () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };
      res.once("finish", done);
      res.once("close", done);
      app(req, res);
    });
  } catch (err) {
    appPromise = null;
    console.error("Vercel handler initialization error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Workspace API initialization failed." });
    }
  }
}
export {
  handler as default
};
