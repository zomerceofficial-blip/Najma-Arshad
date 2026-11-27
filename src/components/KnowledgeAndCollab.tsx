import React, { useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Copy,
  Download,
  History,
  Lock,
  MessageSquare,
  Paperclip,
  Plus,
  Search,
  Send,
} from 'lucide-react';
import { api, type WorkspaceBootstrapData } from '../lib/api.ts';
import type { DocumentRecord, WorkPackage } from '../types/workspace.ts';
import { WorkspaceChat } from './WorkspaceChat.tsx';
import type { ToastMessage } from './ToastAndDialogs.tsx';

interface KnowledgeAndCollabProps {
  section: 'documents' | 'knowledge' | 'files' | 'chat' | 'meetings';
  data: WorkspaceBootstrapData;
  onRefresh: () => Promise<void>;
  onSelectWorkPackage: (wp: WorkPackage) => void;
  onPromoteToWorkPackage?: (prefillTitle: string, prefillDesc: string) => void;
  onNotify?: (tone: ToastMessage['tone'], title: string, detail?: string) => void;
}

function SafeMarkdownView({ content }: { content: string }) {
  const lines = content.split('\n');
  return (
    <div className="space-y-2.5 text-sm text-[#111215] dark:text-[#E5E7EB] leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith('# ')) {
          return (
            <h1 key={i} className="font-display text-lg font-semibold text-[#111215] dark:text-[#F3F4F6] pt-1">
              {line.slice(2)}
            </h1>
          );
        }
        if (line.startsWith('## ')) {
          return (
            <h2 key={i} className="font-display text-sm font-semibold text-[#111215] dark:text-[#F3F4F6] pt-2">
              {line.slice(3)}
            </h2>
          );
        }
        if (line.startsWith('- ') || /^\d+\.\s/.test(line)) {
          return (
            <div key={i} className="pl-4 text-xs text-[#111215] dark:text-[#E5E7EB] flex items-start gap-2">
              <span className="text-[#5E6572] dark:text-[#9CA3AF] select-none">•</span>
              <span>{line.replace(/^(-\s|\d+\.\s)/, '')}</span>
            </div>
          );
        }
        if (!line.trim()) return <div key={i} className="h-1" />;
        return (
          <p key={i} className="text-xs text-[#111215] dark:text-[#E5E7EB]">
            {line}
          </p>
        );
      })}
    </div>
  );
}

export function KnowledgeAndCollab({
  section,
  data,
  onRefresh,
  onSelectWorkPackage,
  onPromoteToWorkPackage,
  onNotify,
}: KnowledgeAndCollabProps) {
  const [selectedDocId, setSelectedDocId] = useState<string>(data.documents[0]?.id || '');
  const [mobileReaderOpen, setMobileReaderOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [docFilter, setDocFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [previewVersion, setPreviewVersion] = useState<number | null>(null);

  const activeDoc: DocumentRecord | undefined =
    data.documents.find((d) => d.id === selectedDocId) || data.documents[0];

  const [draftTitle, setDraftTitle] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [draftCategory, setDraftCategory] = useState<DocumentRecord['category']>('ADR');
  const [draftStatus, setDraftStatus] = useState<DocumentRecord['status']>('Draft');
  const [draftProjectId, setDraftProjectId] = useState<string>(data.projects[0]?.id || '');
  const [draftRestricted, setDraftRestricted] = useState(false);
  const [draftLinkedWorkIds, setDraftLinkedWorkIds] = useState<string[]>([]);
  const [revisionSummary, setRevisionSummary] = useState('');
  const [docCommentText, setDocCommentText] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Schedule meeting state
  const [showNewMeeting, setShowNewMeeting] = useState(false);
  const [mtgTitle, setMtgTitle] = useState('');
  const [mtgDate, setMtgDate] = useState('2026-12-03');
  const [mtgTime, setMtgTime] = useState('15:00 – 15:45 UTC');
  const [mtgProjectId, setMtgProjectId] = useState(data.projects[0]?.id || '');
  const [mtgChannel, setMtgChannel] = useState('#ctrl-plane-dev');
  const [mtgAgenda, setMtgAgenda] = useState('');

  const canEditWork = data.currentUser.role !== 'Read-only Observer';

  const getUserName = (id: string) =>
    data.users.find((u) => u.id === id)?.displayName || 'Unknown';

  function startEdit(doc: DocumentRecord) {
    setDraftTitle(doc.title);
    setDraftBody(doc.body);
    setDraftStatus(doc.status);
    setDraftRestricted(doc.restricted);
    setDraftLinkedWorkIds(doc.linkedWorkIds);
    setRevisionSummary('');
    setEditing(true);
    setCreating(false);
    setMobileReaderOpen(true);
    setError(null);
  }

  function startCreate() {
    setDraftTitle('');
    setDraftBody('# Context\n\n# Decision\n\n# Consequences\n');
    setDraftCategory('ADR');
    setDraftStatus('Draft');
    setDraftRestricted(false);
    setDraftLinkedWorkIds([]);
    setCreating(true);
    setEditing(false);
    setMobileReaderOpen(true);
    setError(null);
  }

  async function handleSaveDoc(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (creating) {
        const created = await api.createDocument({
          title: draftTitle,
          body: draftBody,
          category: draftCategory,
          status: draftStatus,
          projectId: draftProjectId || null,
          restricted: draftRestricted,
          linkedWorkIds: draftLinkedWorkIds,
        });
        setCreating(false);
        await onRefresh();
        setSelectedDocId(created.id);
      } else if (activeDoc) {
        await api.updateDocument(activeDoc.id, {
          title: draftTitle,
          body: draftBody,
          status: draftStatus,
          restricted: draftRestricted,
          linkedWorkIds: draftLinkedWorkIds,
          summary: revisionSummary,
          version: activeDoc.version,
        });
        setEditing(false);
        await onRefresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Document save failed.');
    }
  }

  async function handlePostDocComment(e: React.FormEvent) {
    e.preventDefault();
    if (!activeDoc || !docCommentText.trim()) return;
    setError(null);
    try {
      await api.addDocumentComment(activeDoc.id, docCommentText.trim());
      setDocCommentText('');
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not post comment.');
    }
  }

  async function handleReactDocComment(commentId: string, label: 'ACK' | '+1' | 'Verified') {
    setError(null);
    try {
      await api.reactComment(commentId, label);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update reaction.');
    }
  }

  async function handleUploadStandalone(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !data.projects[0]) return;
    setError(null);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const result = String(reader.result || '');
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        await api.uploadAttachment({
          parentType: 'document',
          parentId: activeDoc?.id || data.documents[0]?.id || 'doc-general',
          projectId: activeDoc?.projectId || data.projects[0].id,
          fileName: file.name,
          mediaType: file.type || 'text/plain',
          contentBase64: base64,
        });
        await onRefresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed.');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  async function handleCreateMeeting(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.createMeeting({
        title: mtgTitle,
        date: mtgDate,
        timeRange: mtgTime,
        projectId: mtgProjectId || null,
        channelRef: mtgChannel,
        agendaSummary: mtgAgenda,
      });
      setShowNewMeeting(false);
      setMtgTitle('');
      setMtgAgenda('');
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not schedule meeting.');
    }
  }

  if (section === 'documents' || section === 'knowledge') {
    const filteredDocs = data.documents.filter((d) => {
      if (categoryFilter !== 'ALL' && d.category !== categoryFilter) return false;
      if (docFilter.trim()) {
        const q = docFilter.toLowerCase();
        return d.title.toLowerCase().includes(q) || d.body.toLowerCase().includes(q);
      }
      return true;
    });

    const docComments = activeDoc
      ? data.comments.filter((c) => c.resourceType === 'document' && c.resourceId === activeDoc.id)
      : [];

    const showingDetailOnMobile = mobileReaderOpen || creating || editing;

    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-[#111215] dark:text-[#F3F4F6] tracking-tight">
              {section === 'knowledge' ? 'Knowledge Base & Standards' : 'Documents & Decision Records'}
            </h1>
            <p className="text-sm text-[#5E6572] dark:text-[#9CA3AF] mt-0.5">
              Markdown-first specifications, ADRs, RFCs, and versioned architecture records
            </p>
          </div>
          {canEditWork && (
            <button
              type="button"
              onClick={startCreate}
              className="h-10 sm:h-9 px-5 bg-[#111215] hover:bg-[#262930] dark:bg-[#F3F4F6] dark:hover:bg-[#D8D8D8] text-white dark:text-[#0B0C0E] text-xs font-medium rounded-full inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Document / ADR</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Document List */}
          <div
            className={`${
              showingDetailOnMobile ? 'hidden lg:flex' : 'flex'
            } lg:col-span-4 bg-white dark:bg-[#111318] border border-[#E2E5EA] dark:border-white/[0.08] rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(11,12,14,0.03)] dark:shadow-none flex-col`}
          >
            <div className="p-3.5 border-b border-[#E2E5EA] dark:border-white/[0.08] space-y-2.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#5E6572] dark:text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={docFilter}
                  onChange={(e) => setDocFilter(e.target.value)}
                  placeholder="Search docs & ADRs…"
                  className="w-full h-10 sm:h-9 pl-8 pr-3 text-base sm:text-xs bg-white dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-full"
                />
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                aria-label="Filter document category"
                className="w-full h-10 sm:h-9 px-3 text-sm sm:text-xs bg-white dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-full"
              >
                <option value="ALL">All Categories</option>
                {['ADR', 'RFC', 'Specification', 'Runbook', 'Announcement'].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="divide-y divide-[#EFF1F4] dark:divide-white/[0.06]">
              {filteredDocs.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => {
                    setSelectedDocId(doc.id);
                    setEditing(false);
                    setCreating(false);
                    setMobileReaderOpen(true);
                  }}
                  className={`w-full text-left px-4 py-3.5 hover:bg-[#F8F9FA] dark:hover:bg-[#14171D] transition-colors ${
                    activeDoc?.id === doc.id && !creating ? 'bg-[#ECEEF2] dark:bg-[#181B22]' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-[11px] text-[#5E6572] dark:text-[#9CA3AF]">
                    <span className="font-mono font-semibold text-[#111215] dark:text-[#F3F4F6]">{doc.category}</span>
                    <span className="flex items-center gap-1 tabular-nums">
                      {doc.restricted && <Lock className="w-3 h-3 text-[#B42318] dark:text-[#FDA29B]" />}
                      v{doc.version} · {doc.status}
                    </span>
                  </div>
                  <div className="text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mt-1">{doc.title}</div>
                </button>
              ))}
              {filteredDocs.length === 0 && (
                <div className="p-6 text-center text-xs text-[#5E6572] dark:text-[#9CA3AF]">No matching documents.</div>
              )}
            </div>
          </div>

          {/* Document Reader / Editor */}
          <div
            className={`${
              showingDetailOnMobile ? 'block' : 'hidden lg:block'
            } lg:col-span-8 bg-white dark:bg-[#111318] border border-[#E2E5EA] dark:border-white/[0.08] rounded-2xl p-4 sm:p-6 shadow-[0_1px_3px_rgba(11,12,14,0.03)] dark:shadow-none`}
          >
            <div className="lg:hidden mb-4 pb-3 border-b border-[#EFF1F4] dark:border-[#1B1F28]">
              <button
                type="button"
                onClick={() => {
                  setMobileReaderOpen(false);
                  setCreating(false);
                  setEditing(false);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#111215] dark:text-[#F3F4F6] h-9 px-3 rounded-full bg-[#F3F4F6] dark:bg-[#181B22]"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Documents</span>
              </button>
            </div>

            {error && (
              <div role="alert" className="mb-4 p-3.5 rounded-2xl border border-[#F5C6C2] dark:border-[#5E2325] bg-[#FEF0EE] dark:bg-[#2E1314] text-[#B42318] dark:text-[#FDA29B] text-xs">
                {error}
              </div>
            )}

            {creating || editing ? (
              <form onSubmit={handleSaveDoc} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-sm font-semibold text-[#111215] dark:text-[#F3F4F6]">
                    {creating ? 'Create New Document' : `Editing v${activeDoc?.version}`}
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      setCreating(false);
                      setEditing(false);
                    }}
                    className="text-xs text-[#5E6572] dark:text-[#9CA3AF] hover:text-[#111215] dark:hover:text-[#F3F4F6]"
                  >
                    Cancel
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mb-1">Title</label>
                  <input
                    type="text"
                    required
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    className="w-full h-11 sm:h-10 px-3.5 text-base sm:text-sm bg-white dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  {creating && (
                    <div>
                      <label className="block text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mb-1">Category</label>
                      <select
                        value={draftCategory}
                        onChange={(e) => setDraftCategory(e.target.value as DocumentRecord['category'])}
                        className="w-full h-11 sm:h-9 px-2.5 text-base sm:text-xs bg-white dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-xl"
                      >
                        {['ADR', 'RFC', 'Specification', 'Runbook', 'Announcement'].map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mb-1">Status</label>
                    <select
                      value={draftStatus}
                      onChange={(e) => setDraftStatus(e.target.value as DocumentRecord['status'])}
                      className="w-full h-11 sm:h-9 px-2.5 text-base sm:text-xs bg-white dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-xl"
                    >
                      {['Draft', 'In Review', 'Accepted', 'Published', 'Superseded'].map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  {creating && (
                    <div>
                      <label className="block text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mb-1">Project</label>
                      <select
                        value={draftProjectId}
                        onChange={(e) => setDraftProjectId(e.target.value)}
                        className="w-full h-11 sm:h-9 px-2.5 text-base sm:text-xs bg-white dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-xl"
                      >
                        <option value="">Workspace-wide</option>
                        {data.projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.key} · {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="flex items-end pb-2">
                    <label className="inline-flex items-center gap-2 text-xs text-[#111215] dark:text-[#E5E7EB] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={draftRestricted}
                        onChange={(e) => setDraftRestricted(e.target.checked)}
                      />
                      <span>Restricted access</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mb-1">
                    Markdown Body
                  </label>
                  <textarea
                    rows={11}
                    required
                    value={draftBody}
                    onChange={(e) => setDraftBody(e.target.value)}
                    className="w-full p-3.5 text-sm sm:text-xs font-mono bg-white dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-2xl"
                  />
                </div>

                <div>
                  <div className="text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mb-1.5">
                    Linked Work Packages
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-2.5 bg-[#F8F9FA] dark:bg-[#161922] border border-[#D8DCE3] dark:border-white/[0.12] rounded-xl">
                    {data.workPackages.map((wp) => {
                      const linked = draftLinkedWorkIds.includes(wp.id);
                      return (
                        <label
                          key={wp.id}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-mono cursor-pointer transition-colors ${
                            linked
                              ? 'bg-[#111215] dark:bg-[#F3F4F6] text-white dark:text-[#0B0C0E] border-[#111215] dark:border-[#F3F4F6]'
                              : 'bg-white dark:bg-[#111318] text-[#111215] dark:text-[#E5E7EB] border-[#D8DCE3] dark:border-white/[0.12]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={linked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setDraftLinkedWorkIds((prev) => Array.from(new Set([...prev, wp.id])));
                              } else {
                                setDraftLinkedWorkIds((prev) => prev.filter((id) => id !== wp.id));
                              }
                            }}
                            className="sr-only"
                          />
                          <span>{wp.key}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {!creating && (
                  <div>
                    <label className="block text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mb-1">
                      Revision Summary
                    </label>
                    <input
                      type="text"
                      value={revisionSummary}
                      onChange={(e) => setRevisionSummary(e.target.value)}
                      placeholder="Summarize what changed in this revision…"
                      className="w-full h-11 sm:h-9 px-3.5 text-base sm:text-xs bg-white dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-xl"
                    />
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <button
                    type="submit"
                    className="h-10 sm:h-9 px-5 bg-[#111215] hover:bg-[#262930] dark:bg-[#F3F4F6] dark:hover:bg-[#D8D8D8] text-white dark:text-[#0B0C0E] text-xs font-medium rounded-full"
                  >
                    {creating ? 'Publish Document' : 'Save New Version'}
                  </button>
                </div>
              </form>
            ) : activeDoc ? (
              <div className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-[#E2E5EA] dark:border-white/[0.08]">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#5E6572] dark:text-[#9CA3AF]">
                      <BookOpen className="w-3.5 h-3.5 text-[#111215] dark:text-[#D8D8D8]" />
                      <span className="font-mono font-semibold text-[#111215] dark:text-[#F3F4F6]">{activeDoc.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>{activeDoc.status}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">v{activeDoc.version}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {activeDoc.body.trim().split(/\s+/).filter(Boolean).length} words · ~
                        {Math.max(1, Math.ceil(activeDoc.body.trim().split(/\s+/).filter(Boolean).length / 180))} min read
                      </span>
                      {activeDoc.restricted && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-[#B42318] dark:text-[#FDA29B] inline-flex items-center gap-1 font-medium">
                            <Lock className="w-3 h-3" /> Restricted
                          </span>
                        </>
                      )}
                    </div>
                    <h2 className="font-display text-lg font-semibold text-[#111215] dark:text-[#F3F4F6] mt-1">
                      {activeDoc.title}
                    </h2>
                    <div className="text-xs text-[#5E6572] dark:text-[#9CA3AF] mt-1 font-mono break-all">
                      Permanent URL: /kb/{activeDoc.slug} · Owner: {getUserName(activeDoc.ownerId)}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(`${window.location.origin}/kb/${activeDoc.slug}`).catch(() => {});
                        onNotify?.('info', 'Permanent doc URL copied', `/kb/${activeDoc.slug}`);
                      }}
                      className="h-9 sm:h-8 px-3 bg-white dark:bg-[#161922] border border-[#D8DCE3] dark:border-white/[0.12] hover:bg-[#ECEEF2] dark:hover:bg-[#1D212A] text-[#111215] dark:text-[#F3F4F6] text-xs font-medium rounded-full inline-flex items-center gap-1.5"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Copy Link</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const blob = new Blob([`# ${activeDoc.title}\n\n${activeDoc.body}`], { type: 'text/markdown;charset=utf-8' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${activeDoc.slug || 'document'}-v${activeDoc.version}.md`;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        URL.revokeObjectURL(url);
                        onNotify?.('success', 'Exported Markdown document');
                      }}
                      className="h-9 sm:h-8 px-3 bg-white dark:bg-[#161922] border border-[#D8DCE3] dark:border-white/[0.12] hover:bg-[#ECEEF2] dark:hover:bg-[#1D212A] text-[#111215] dark:text-[#F3F4F6] text-xs font-medium rounded-full inline-flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">.md</span>
                    </button>
                    {canEditWork && (
                      <button
                        type="button"
                        onClick={() => startEdit(activeDoc)}
                        className="h-9 sm:h-8 px-4 bg-white dark:bg-[#161922] border border-[#D8DCE3] dark:border-white/[0.12] hover:bg-[#ECEEF2] dark:hover:bg-[#1D212A] text-[#111215] dark:text-[#F3F4F6] text-xs font-medium rounded-full"
                      >
                        Edit & Version
                      </button>
                    )}
                  </div>
                </div>

                {previewVersion !== null && (
                  <div className="p-3 rounded-2xl bg-[#FEF7E6] dark:bg-[#29200C] border border-[#F0D9A6] dark:border-[#523E14] flex items-center justify-between gap-3 text-xs text-[#9B6B08] dark:text-[#FCD34D]">
                    <span>Viewing historical snapshot v{previewVersion}</span>
                    <button
                      type="button"
                      onClick={() => setPreviewVersion(null)}
                      className="font-semibold underline"
                    >
                      Return to Latest (v{activeDoc.version})
                    </button>
                  </div>
                )}

                <SafeMarkdownView
                  content={
                    previewVersion !== null
                      ? activeDoc.versions.find((v) => v.version === previewVersion)?.body || activeDoc.body
                      : activeDoc.body
                  }
                />

                {activeDoc.linkedWorkIds.length > 0 && (
                  <div className="pt-4 border-t border-[#EFF1F4] dark:border-[#1B1F28]">
                    <div className="text-xs font-semibold text-[#111215] dark:text-[#F3F4F6] mb-2">Linked Work Packages</div>
                    <div className="flex flex-wrap gap-2">
                      {activeDoc.linkedWorkIds.map((wid) => {
                        const wp = data.workPackages.find((w) => w.id === wid);
                        if (!wp) return null;
                        return (
                          <button
                            key={wid}
                            type="button"
                            onClick={() => onSelectWorkPackage(wp)}
                            className="px-3 py-1 text-xs font-mono bg-[#F8F9FA] dark:bg-[#161922] border border-[#D8DCE3] dark:border-white/[0.12] hover:border-[#111215] dark:hover:border-[#D8D8D8] rounded-full text-[#111215] dark:text-[#F3F4F6]"
                          >
                            {wp.key} · {wp.title}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-[#EFF1F4] dark:border-[#1B1F28]">
                  <div className="text-xs font-semibold text-[#111215] dark:text-[#F3F4F6] mb-2 flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-[#5E6572] dark:text-[#9CA3AF]" />
                    <span>Version History</span>
                  </div>
                  <div className="divide-y divide-[#EFF1F4] dark:divide-white/[0.06] text-xs">
                    {activeDoc.versions.map((ver) => (
                      <div key={ver.version} className="py-1.5 flex flex-wrap items-center justify-between gap-2 text-[#5E6572] dark:text-[#9CA3AF]">
                        <span>
                          <strong className="font-mono text-[#111215] dark:text-[#F3F4F6]">v{ver.version}</strong> · {ver.summary} (by{' '}
                          {getUserName(ver.editorId)})
                        </span>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setPreviewVersion(previewVersion === ver.version ? null : ver.version)}
                            className="text-[11px] font-medium text-[#111215] dark:text-[#F3F4F6] hover:underline"
                          >
                            {previewVersion === ver.version ? 'Latest' : 'Preview'}
                          </button>
                          <span className="font-mono text-[11px] tabular-nums">
                            {new Date(ver.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Document Discussion Comments */}
                <div className="pt-4 border-t border-[#EFF1F4] dark:border-[#1B1F28] space-y-3">
                  <div className="text-xs font-semibold text-[#111215] dark:text-[#F3F4F6] flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-[#5E6572] dark:text-[#9CA3AF]" />
                    <span>Review Discussion ({docComments.length})</span>
                  </div>

                  {docComments.length > 0 ? (
                    <div className="space-y-2.5">
                      {docComments.map((c) => (
                        <div key={c.id} className="p-3.5 rounded-2xl bg-[#F8F9FA] dark:bg-[#161922] border border-[#E2E5EA] dark:border-white/[0.08] space-y-2">
                          <div className="flex items-center justify-between gap-2 text-[11px] text-[#5E6572] dark:text-[#9CA3AF]">
                            <span className="font-semibold text-[#111215] dark:text-[#F3F4F6]">{getUserName(c.authorId)}</span>
                            <span className="font-mono tabular-nums">{new Date(c.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="text-xs text-[#111215] dark:text-[#E5E7EB] leading-relaxed">{c.body}</p>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {(['ACK', '+1', 'Verified'] as const).map((label) => {
                              const count = (c.reactions[label] || []).length;
                              const active = (c.reactions[label] || []).includes(data.currentUser.id);
                              return (
                                <button
                                  key={label}
                                  type="button"
                                  onClick={() => handleReactDocComment(c.id, label)}
                                  className={`px-2.5 py-0.5 rounded-full border text-[11px] font-mono transition-colors ${
                                    active
                                      ? 'bg-[#111215] dark:bg-[#F3F4F6] text-white dark:text-[#0B0C0E] border-[#111215] dark:border-[#F3F4F6]'
                                      : 'bg-white dark:bg-[#111318] text-[#5E6572] dark:text-[#9CA3AF] border-[#D8DCE3] dark:border-white/[0.12]'
                                  }`}
                                >
                                  {label} {count > 0 ? count : ''}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[#5E6572] dark:text-[#9CA3AF]">No comments on this document yet.</p>
                  )}

                  {canEditWork && (
                    <form onSubmit={handlePostDocComment} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={docCommentText}
                        onChange={(e) => setDocCommentText(e.target.value)}
                        placeholder="Add review note or @mention…"
                        className="flex-1 h-10 sm:h-9 px-3.5 text-base sm:text-xs bg-white dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-full"
                      />
                      <button
                        type="submit"
                        disabled={!docCommentText.trim()}
                        aria-label="Post document comment"
                        className="h-10 sm:h-9 px-4 bg-[#111215] hover:bg-[#262930] dark:bg-[#F3F4F6] dark:hover:bg-[#D8D8D8] text-white dark:text-[#0B0C0E] rounded-full text-xs font-medium inline-flex items-center gap-1.5 disabled:opacity-40"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Post</span>
                      </button>
                    </form>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-[#5E6572] dark:text-[#9CA3AF]">No documents match the filter.</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (section === 'files') {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-[#111215] dark:text-[#F3F4F6] tracking-tight">Files & Attachments</h1>
            <p className="text-sm text-[#5E6572] dark:text-[#9CA3AF] mt-0.5">
              Authorization-checked attachment custody with SHA-256 checksums
            </p>
          </div>
          {canEditWork && (
            <label className="h-10 sm:h-9 px-5 bg-[#111215] hover:bg-[#262930] dark:bg-[#F3F4F6] dark:hover:bg-[#D8D8D8] text-white dark:text-[#0B0C0E] text-xs font-medium rounded-full inline-flex items-center gap-1.5 cursor-pointer">
              <Plus className="w-3.5 h-3.5" />
              <span>Upload File</span>
              <input type="file" onChange={handleUploadStandalone} className="hidden" />
            </label>
          )}
        </div>

        {error && (
          <div role="alert" className="p-3.5 rounded-2xl border border-[#F5C6C2] dark:border-[#5E2325] bg-[#FEF0EE] dark:bg-[#2E1314] text-[#B42318] dark:text-[#FDA29B] text-xs">
            {error}
          </div>
        )}

        {/* Mobile File Cards */}
        <div className="md:hidden space-y-2.5">
          {data.attachments.map((att) => (
            <div key={att.id} className="bg-white dark:bg-[#111318] border border-[#E2E5EA] dark:border-white/[0.08] rounded-2xl p-4 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Paperclip className="w-4 h-4 text-[#111215] dark:text-[#D8D8D8] shrink-0" />
                  <span className="text-sm font-medium text-[#111215] dark:text-[#F3F4F6] truncate">{att.fileName}</span>
                </div>
                <span className="text-xs font-mono tabular-nums text-[#5E6572] dark:text-[#9CA3AF] shrink-0">
                  {(att.sizeBytes / 1024).toFixed(1)} KB
                </span>
              </div>
              <div className="text-[11px] font-mono text-[#5E6572] dark:text-[#9CA3AF] space-y-0.5 break-all">
                <div>Type: {att.mediaType}</div>
                <div>SHA-256: {att.checksumSha256.slice(0, 24)}…</div>
              </div>
              <button
                type="button"
                onClick={() => api.downloadAttachment(att.id, att.fileName)}
                className="w-full h-10 border border-[#D8DCE3] dark:border-white/[0.12] text-[#111215] dark:text-[#F3F4F6] rounded-full text-xs font-medium inline-flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download File</span>
              </button>
            </div>
          ))}
          {data.attachments.length === 0 && (
            <div className="bg-white dark:bg-[#111318] border border-[#E2E5EA] dark:border-white/[0.08] rounded-2xl py-10 px-4 text-center text-xs text-[#5E6572] dark:text-[#9CA3AF]">
              No files uploaded yet. Upload a specification, diagram, or test report above or inside any Work Package.
            </div>
          )}
        </div>

        {/* Desktop Files Table */}
        <div className="hidden md:block bg-white dark:bg-[#111318] border border-[#E2E5EA] dark:border-white/[0.08] rounded-2xl overflow-x-auto shadow-[0_1px_3px_rgba(11,12,14,0.03)] dark:shadow-none">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-[#F8F9FA] dark:bg-[#161922] border-b border-[#E2E5EA] dark:border-white/[0.08] text-[11px] font-semibold text-[#5E6572] dark:text-[#9CA3AF]">
                <th className="py-3 px-5">File Name</th>
                <th className="py-3 px-4">Media Type</th>
                <th className="py-3 px-4">SHA-256 Checksum</th>
                <th className="py-3 px-4 text-right">Size</th>
                <th className="py-3 px-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFF1F4] dark:divide-white/[0.06] text-xs">
              {data.attachments.map((att) => (
                <tr key={att.id} className="h-11">
                  <td className="py-2 px-5 font-medium text-[#111215] dark:text-[#F3F4F6] flex items-center gap-2">
                    <Paperclip className="w-3.5 h-3.5 text-[#111215] dark:text-[#D8D8D8]" />
                    <span>{att.fileName}</span>
                  </td>
                  <td className="py-2 px-4 font-mono text-[#5E6572] dark:text-[#9CA3AF]">{att.mediaType}</td>
                  <td className="py-2 px-4 font-mono text-[#5E6572] dark:text-[#9CA3AF]">{att.checksumSha256.slice(0, 20)}…</td>
                  <td className="py-2 px-4 text-right font-mono tabular-nums text-[#5E6572] dark:text-[#9CA3AF]">
                    {(att.sizeBytes / 1024).toFixed(1)} KB
                  </td>
                  <td className="py-2 px-5 text-right">
                    <button
                      type="button"
                      onClick={() => api.downloadAttachment(att.id, att.fileName)}
                      className="h-7 px-3 border border-[#D8DCE3] dark:border-white/[0.12] text-[#111215] dark:text-[#F3F4F6] rounded-full hover:bg-[#ECEEF2] dark:hover:bg-[#181B22] inline-flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" />
                      <span>Download</span>
                    </button>
                  </td>
                </tr>
              ))}
              {data.attachments.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-xs text-[#5E6572] dark:text-[#9CA3AF]">
                    No files uploaded yet. Upload a specification, diagram, or test report above or inside any Work Package.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (section === 'chat') {
    return (
      <WorkspaceChat
        data={data}
        onRefresh={onRefresh}
        onSelectWorkPackage={onSelectWorkPackage}
        onPromoteToWorkPackage={onPromoteToWorkPackage || (() => {})}
        onNotify={onNotify || (() => {})}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[#111215] dark:text-[#F3F4F6] tracking-tight">Engineering Meetings</h1>
          <p className="text-sm text-[#5E6572] dark:text-[#9CA3AF] mt-0.5">
            Architecture review boards, milestone readiness checks, and QA triage sessions
          </p>
        </div>
        {canEditWork && (
          <button
            type="button"
            onClick={() => setShowNewMeeting((v) => !v)}
            className="h-10 sm:h-9 px-5 bg-[#111215] hover:bg-[#262930] dark:bg-[#F3F4F6] dark:hover:bg-[#D8D8D8] text-white dark:text-[#0B0C0E] text-xs font-medium rounded-full inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Schedule Meeting</span>
          </button>
        )}
      </div>

      {error && (
        <div role="alert" className="p-3.5 rounded-2xl border border-[#F5C6C2] dark:border-[#5E2325] bg-[#FEF0EE] dark:bg-[#2E1314] text-[#B42318] dark:text-[#FDA29B] text-xs">
          {error}
        </div>
      )}

      {showNewMeeting && (
        <form onSubmit={handleCreateMeeting} className="bg-white dark:bg-[#111318] border border-[#E2E5EA] dark:border-white/[0.08] rounded-2xl p-5 space-y-4">
          <h2 className="font-display text-sm font-semibold text-[#111215] dark:text-[#F3F4F6]">Schedule Engineering Review</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mb-1">Meeting Title</label>
              <input
                type="text"
                required
                value={mtgTitle}
                onChange={(e) => setMtgTitle(e.target.value)}
                placeholder="Architecture Review Board — Sprint Sync"
                className="w-full h-11 sm:h-9 px-3 text-base sm:text-xs bg-white dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mb-1">Date</label>
              <input
                type="date"
                required
                value={mtgDate}
                onChange={(e) => setMtgDate(e.target.value)}
                className="w-full h-11 sm:h-9 px-3 text-base sm:text-xs font-mono bg-white dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mb-1">Time Window</label>
              <input
                type="text"
                required
                value={mtgTime}
                onChange={(e) => setMtgTime(e.target.value)}
                className="w-full h-11 sm:h-9 px-3 text-base sm:text-xs font-mono bg-white dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-xl"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mb-1">Project</label>
              <select
                value={mtgProjectId}
                onChange={(e) => setMtgProjectId(e.target.value)}
                className="w-full h-11 sm:h-9 px-2.5 text-base sm:text-xs bg-white dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-xl"
              >
                <option value="">Workspace-wide</option>
                {data.projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.key} · {p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mb-1">Channel Ref</label>
              <input
                type="text"
                value={mtgChannel}
                onChange={(e) => setMtgChannel(e.target.value)}
                className="w-full h-11 sm:h-9 px-3 text-base sm:text-xs font-mono bg-white dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mb-1">Agenda Summary</label>
              <input
                type="text"
                value={mtgAgenda}
                onChange={(e) => setMtgAgenda(e.target.value)}
                placeholder="Key risks, sign-offs, and action items"
                className="w-full h-11 sm:h-9 px-3 text-base sm:text-xs bg-white dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-xl"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowNewMeeting(false)}
              className="h-10 sm:h-9 px-4 border border-[#D8DCE3] dark:border-white/[0.12] text-[#111215] dark:text-[#E5E7EB] rounded-full text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-10 sm:h-9 px-5 bg-[#111215] dark:bg-[#F3F4F6] text-white dark:text-[#0B0C0E] rounded-full text-xs font-medium"
            >
              Schedule
            </button>
          </div>
        </form>
      )}

      <div className="bg-white dark:bg-[#111318] border border-[#E2E5EA] dark:border-white/[0.08] rounded-2xl overflow-hidden divide-y divide-[#EFF1F4] dark:divide-white/[0.06] shadow-[0_1px_3px_rgba(11,12,14,0.03)] dark:shadow-none">
        {data.meetings.map((m) => (
          <div key={m.id} className="px-4 sm:px-5 py-4 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#111215] dark:text-[#F3F4F6]">
                <Calendar className="w-4 h-4 text-[#111215] dark:text-[#D8D8D8] shrink-0" />
                <span>{m.title}</span>
              </div>
              <p className="text-xs text-[#5E6572] dark:text-[#9CA3AF]">{m.agendaSummary}</p>
              <div className="text-xs text-[#5E6572] dark:text-[#9CA3AF] flex flex-wrap items-center gap-2">
                <span>Facilitator: {getUserName(m.facilitatorId)}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-[#111215] dark:text-[#F3F4F6]">{m.channelRef}</span>
              </div>
            </div>
            <div className="sm:text-right font-mono text-xs tabular-nums">
              <div className="font-semibold text-[#111215] dark:text-[#F3F4F6]">{m.date}</div>
              <div className="text-[#5E6572] dark:text-[#9CA3AF]">{m.timeRange}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
