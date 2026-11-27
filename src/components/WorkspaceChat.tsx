import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  AtSign,
  Bell,
  BellOff,
  Check,
  Copy,
  Edit3,
  Hash,
  Lock,
  MessageSquare,
  Pin,
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { api, type WorkspaceBootstrapData } from '../lib/api.ts';
import { mirrorChatMessageToFirestore, subscribeFirestoreChannelMessages } from '../lib/firebase.ts';
import type {
  ChatChannel,
  ChatMessage,
  ChatNotificationMode,
  User,
  WorkPackage,
} from '../types/workspace.ts';
import { ConfirmDialog, type ToastMessage } from './ToastAndDialogs.tsx';
import { UserAvatar } from './StatusLabel.tsx';

interface WorkspaceChatProps {
  data: WorkspaceBootstrapData;
  onRefresh: () => Promise<void>;
  onSelectWorkPackage: (wp: WorkPackage) => void;
  onPromoteToWorkPackage: (prefillTitle: string, prefillDesc: string) => void;
  onNotify: (tone: ToastMessage['tone'], title: string, detail?: string) => void;
}

const PRESENCE_DOT: Record<NonNullable<User['presence']>, string> = {
  active: 'bg-[#1F764D] dark:bg-[#34D399]',
  focus: 'bg-[#2563EB] dark:bg-[#60A5FA]',
  reviewing: 'bg-[#B57C0A] dark:bg-[#FBBF24]',
  away: 'bg-[#9CA3AF] dark:bg-[#6B7280]',
};

export function WorkspaceChat({
  data,
  onRefresh,
  onSelectWorkPackage,
  onPromoteToWorkPackage,
  onNotify,
}: WorkspaceChatProps) {
  const [selectedChannelId, setSelectedChannelId] = useState<string>(data.chatChannels[0]?.id || 'ch-general');
  const [threadParentId, setThreadParentId] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'mentions' | 'pinned'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [composer, setComposer] = useState('');
  const [sending, setSending] = useState(false);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState('');
  const [threadReply, setThreadReply] = useState('');
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [newChanName, setNewChanName] = useState('');
  const [newChanTopic, setNewChanTopic] = useState('');
  const [newChanProjId, setNewChanProjId] = useState('');
  const [newChanPrivate, setNewChanPrivate] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [firestoreLiveCount, setFirestoreLiveCount] = useState<number | null>(null);

  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const endOfListRef = useRef<HTMLDivElement | null>(null);

  const activeChannel: ChatChannel | undefined =
    data.chatChannels.find((c) => c.id === selectedChannelId) || data.chatChannels[0];

  const globalNotifMode: ChatNotificationMode = data.currentUser.chatNotificationMode || 'mentions_only';
  const channelOverrideMode = activeChannel
    ? data.currentUser.channelNotificationModes?.[activeChannel.id]
    : undefined;
  const effectiveNotifMode: ChatNotificationMode = channelOverrideMode || globalNotifMode;

  useEffect(() => {
    if (!activeChannel) return;
    const unsub = subscribeFirestoreChannelMessages(activeChannel.id, (count) => {
      setFirestoreLiveCount(count);
    });
    return () => {
      if (unsub) unsub();
      setFirestoreLiveCount(null);
    };
  }, [activeChannel?.id]);

  // Autocomplete triggers: "@..." or "#..."
  const mentionMatch = composer.match(/(?:^|\s)@([a-zA-Z0-9._-]*)$/);
  const workKeyMatch = composer.match(/(?:^|\s)#([a-zA-Z0-9-]*)$/);

  const mentionSuggestions = useMemo(() => {
    if (!mentionMatch) return [];
    const q = mentionMatch[1].toLowerCase();
    const list = data.users.filter(
      (u) => u.state === 'active' && u.displayName.toLowerCase().includes(q)
    );
    return list.slice(0, 6);
  }, [mentionMatch, data.users]);

  const workKeySuggestions = useMemo(() => {
    if (!workKeyMatch) return [];
    const q = workKeyMatch[1].toLowerCase();
    return data.workPackages
      .filter((w) => w.key.toLowerCase().includes(q) || w.title.toLowerCase().includes(q))
      .slice(0, 6);
  }, [workKeyMatch, data.workPackages]);

  const channelMessages = useMemo(() => {
    if (!activeChannel) return [];
    const topLevel = data.chatMessages
      .filter((m) => m.channelId === activeChannel.id && !m.parentMessageId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    return topLevel.filter((m) => {
      if (filterMode === 'mentions') {
        const isMe = m.mentions.includes(data.currentUser.id) || Boolean(m.mentionAll);
        if (!isMe) return false;
      }
      if (filterMode === 'pinned' && !m.pinned) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const author = data.users.find((u) => u.id === m.authorId)?.displayName.toLowerCase() || '';
        return m.body.toLowerCase().includes(q) || author.includes(q);
      }
      return true;
    });
  }, [activeChannel, data.chatMessages, data.currentUser.id, data.users, filterMode, searchQuery]);

  const pinnedMessages = useMemo(() => {
    if (!activeChannel) return [];
    return data.chatMessages.filter((m) => m.channelId === activeChannel.id && m.pinned && !m.parentMessageId);
  }, [activeChannel, data.chatMessages]);

  const threadParent = threadParentId
    ? data.chatMessages.find((m) => m.id === threadParentId) || null
    : null;
  const threadReplies = threadParent
    ? data.chatMessages
        .filter((m) => m.parentMessageId === threadParent.id)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    : [];

  const getUser = (id: string) => data.users.find((u) => u.id === id);

  function getChannelUnreadCount(channelId: string): number {
    return data.notifications.filter(
      (n) => !n.read && n.recipientId === data.currentUser.id && n.resourceType === 'chat_channel' && n.resourceId === channelId
    ).length;
  }

  async function handleSelectChannel(channelId: string) {
    setSelectedChannelId(channelId);
    setThreadParentId(null);
    if (getChannelUnreadCount(channelId) > 0) {
      await api.markChatChannelRead(channelId).catch(() => {});
      await onRefresh();
    }
  }

  async function handleUpdateNotifMode(mode: ChatNotificationMode, scope: 'global' | 'channel') {
    try {
      if (scope === 'global') {
        await api.updatePreferences({ chatNotificationMode: mode });
      } else if (activeChannel) {
        await api.updatePreferences({
          channelNotificationModes: { [activeChannel.id]: mode },
        });
      }
      await onRefresh();
      onNotify(
        'success',
        scope === 'channel' && activeChannel
          ? `#${activeChannel.name} alerts set to ${mode.replace('_', ' ')}`
          : `Global chat alerts set to ${mode.replace('_', ' ')}`,
        mode === 'mentions_only'
          ? 'Only @mentions, @channel broadcasts, and thread replies notify you.'
          : mode === 'all_messages'
          ? 'Every new message in accessible channels triggers an Inbox alert.'
          : 'Non-security chat alerts muted.'
      );
    } catch (err) {
      onNotify('error', 'Could not update notification rule', err instanceof Error ? err.message : undefined);
    }
  }

  function insertAutocomplete(tokenText: string, triggerChar: '@' | '#') {
    const regex = triggerChar === '@' ? /@[a-zA-Z0-9._-]*$/ : /#[a-zA-Z0-9-]*$/;
    setComposer((prev) => prev.replace(regex, `${tokenText} `));
    composerRef.current?.focus();
  }

  async function handleSendMessage(e?: React.FormEvent, parentId?: string | null) {
    if (e) e.preventDefault();
    if (!activeChannel) return;
    const text = parentId ? threadReply.trim() : composer.trim();
    if (!text || sending) return;

    setSending(true);
    try {
      const created = await api.sendChatMessage(activeChannel.id, {
        body: text,
        parentMessageId: parentId || null,
      });
      if (parentId) setThreadReply('');
      else setComposer('');

      if (data.currentUser.authProvider === 'firebase') {
        void mirrorChatMessageToFirestore({
          id: created.id,
          channelId: created.channelId,
          authorId: created.authorId,
          authorName: data.currentUser.displayName,
          body: created.body,
          mentions: created.mentions,
          pinned: created.pinned,
          edited: created.edited,
          parentMessageId: created.parentMessageId,
        });
      }
      await onRefresh();
      if (!parentId) {
        setTimeout(() => endOfListRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
      }
    } catch (err) {
      onNotify('error', 'Failed to send message', err instanceof Error ? err.message : undefined);
    } finally {
      setSending(false);
    }
  }

  async function handleCreateChannel(e: React.FormEvent) {
    e.preventDefault();
    try {
      const ch = await api.createChatChannel({
        name: newChanName,
        topic: newChanTopic,
        projectId: newChanProjId || null,
        isPrivate: newChanPrivate,
      });
      setShowCreateChannel(false);
      setNewChanName('');
      setNewChanTopic('');
      setNewChanProjId('');
      setNewChanPrivate(false);
      await onRefresh();
      setSelectedChannelId(ch.id);
      onNotify('success', `Created channel #${ch.name}`);
    } catch (err) {
      onNotify('error', 'Channel creation failed', err instanceof Error ? err.message : undefined);
    }
  }

  function renderRichBody(body: string) {
    const parts = body.split(/(@[A-Za-z0-9._-]+|#[A-Z]{2,8}-\d+)/g);
    return (
      <span>
        {parts.map((part, idx) => {
          if (part.startsWith('@')) {
            return (
              <span
                key={idx}
                className="inline-block px-1.5 py-0.2 rounded-md bg-[#111215]/8 dark:bg-white/15 font-semibold text-[#111215] dark:text-[#F3F4F6]"
              >
                {part}
              </span>
            );
          }
          if (/^#[A-Z]{2,8}-\d+$/.test(part)) {
            const key = part.slice(1);
            const wp = data.workPackages.find((w) => w.key === key);
            if (wp) {
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSelectWorkPackage(wp)}
                  className="inline-flex items-center gap-0.5 px-2 py-0.5 mx-0.5 rounded-full bg-[#ECEEF2] dark:bg-[#1D212A] border border-[#D4D8DF] dark:border-[#323846] font-mono text-[11px] font-semibold text-[#111215] dark:text-[#F3F4F6] hover:underline"
                >
                  {wp.key}
                </button>
              );
            }
          }
          return <React.Fragment key={idx}>{part}</React.Fragment>;
        })}
      </span>
    );
  }

  const canWrite = data.currentUser.role !== 'Read-only Observer';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[#111215] dark:text-white tracking-tight">
            Engineering Chat & Channels
          </h1>
          <p className="text-sm text-[#5E6572] dark:text-[#9CA3AF] mt-0.5">
            Workspace engineering discussions with Work Package deep links and per-user mention notification controls
          </p>
        </div>

        {/* Global Notification Mode Switcher */}
        <div className="flex flex-wrap items-center gap-1 bg-white dark:bg-[#111318] border border-[#E5E7EB] dark:border-white/[0.08] rounded-xl p-1">
          <span className="text-[11px] text-[#5E6572] dark:text-[#9CA3AF] pl-2.5 pr-1 hidden sm:inline">
            My Alerts:
          </span>
          {(
            [
              { id: 'mentions_only', label: 'Mentions Only', icon: AtSign },
              { id: 'all_messages', label: 'All Messages', icon: Bell },
              { id: 'muted', label: 'Muted', icon: BellOff },
            ] as const
          ).map((opt) => {
            const Icon = opt.icon;
            const active = globalNotifMode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleUpdateNotifMode(opt.id, 'global')}
                className={`h-8 px-3 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[#111215] dark:bg-white text-white dark:text-[#0B0C0E]'
                    : 'text-[#5E6572] dark:text-[#9CA3AF] hover:text-[#111215] dark:hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Chat Container */}
      <div className="bg-white dark:bg-[#111318] border border-[#E5E7EB] dark:border-white/[0.08] rounded-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[600px]">
        {/* Left Channel List */}
        <aside className="lg:col-span-3 border-b lg:border-b-0 lg:border-r border-[#E5E7EB] dark:border-white/[0.08] bg-[#F8F9FA] dark:bg-[#0D0F13] p-3.5 flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold text-[#5E6572] dark:text-[#9CA3AF]">
              Channels ({data.chatChannels.length})
            </span>
            {canWrite && (
              <button
                type="button"
                onClick={() => setShowCreateChannel((v) => !v)}
                aria-label="Create chat channel"
                className="w-7 h-7 rounded-lg border border-[#D8DCE3] dark:border-white/[0.1] bg-white dark:bg-[#14171E] flex items-center justify-center text-[#111215] dark:text-white"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {showCreateChannel && (
            <form
              onSubmit={handleCreateChannel}
              className="p-3 rounded-xl bg-white dark:bg-[#111318] border border-[#E5E7EB] dark:border-white/[0.08] space-y-2.5 text-xs"
            >
              <input
                type="text"
                required
                value={newChanName}
                onChange={(e) => setNewChanName(e.target.value)}
                placeholder="channel-name"
                className="w-full h-8 px-2.5 bg-white dark:bg-[#14171E] border border-[#D8DCE3] dark:border-white/[0.1] rounded-lg font-mono"
              />
              <input
                type="text"
                value={newChanTopic}
                onChange={(e) => setNewChanTopic(e.target.value)}
                placeholder="Topic (optional)"
                className="w-full h-8 px-2.5 bg-white dark:bg-[#14171E] border border-[#D8DCE3] dark:border-white/[0.1] rounded-lg"
              />
              <select
                value={newChanProjId}
                onChange={(e) => setNewChanProjId(e.target.value)}
                className="w-full h-8 px-2 bg-white dark:bg-[#14171E] border border-[#D8DCE3] dark:border-white/[0.1] rounded-lg"
              >
                <option value="">Workspace-wide</option>
                {data.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.key} · {p.name}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-[11px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={newChanPrivate}
                  onChange={(e) => setNewChanPrivate(e.target.checked)}
                />
                <span>Private channel</span>
              </label>
              <div className="flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowCreateChannel(false)}
                  className="h-7 px-3 rounded-lg border border-[#D8DCE3] dark:border-white/[0.1]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-7 px-3 rounded-lg bg-[#111215] dark:bg-white text-white dark:text-[#0B0C0E] font-medium"
                >
                  Create
                </button>
              </div>
            </form>
          )}

          {/* Horizontal on mobile, vertical on lg */}
          <div className="flex lg:flex-col gap-1 overflow-x-auto pb-1 lg:pb-0">
            {data.chatChannels.map((ch) => {
              const active = activeChannel?.id === ch.id;
              const unread = getChannelUnreadCount(ch.id);
              const override = data.currentUser.channelNotificationModes?.[ch.id];
              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => handleSelectChannel(ch.id)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between gap-2 whitespace-nowrap shrink-0 transition-colors ${
                    active
                      ? 'bg-[#111215] dark:bg-white text-white dark:text-[#0B0C0E] font-semibold'
                      : 'text-[#111215] dark:text-[#E5E7EB] hover:bg-[#ECEEF2] dark:hover:bg-white/[0.06]'
                  }`}
                >
                  <span className="flex items-center gap-1.5 truncate">
                    {ch.isPrivate ? <Lock className="w-3.5 h-3.5 shrink-0" /> : <Hash className="w-3.5 h-3.5 shrink-0" />}
                    <span className="truncate font-mono">{ch.name}</span>
                  </span>
                  <span className="flex items-center gap-1 shrink-0">
                    {override === 'muted' && <BellOff className="w-3 h-3 opacity-60" />}
                    {unread > 0 && (
                      <span
                        className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono tabular-nums ${
                          active
                            ? 'bg-white/20 text-white dark:bg-[#0B0C0E]/20 dark:text-[#0B0C0E]'
                            : 'bg-[#111215] dark:bg-white text-white dark:text-[#0B0C0E]'
                        }`}
                      >
                        {unread}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active Members Presence List */}
          <div className="hidden lg:block mt-auto pt-3 border-t border-[#E5E7EB] dark:border-white/[0.08] space-y-2">
            <div className="text-[11px] font-semibold text-[#5E6572] dark:text-[#9CA3AF] px-1">
              Directory Presence ({data.users.filter((u) => u.state === 'active').length}/{data.maxSlots})
            </div>
            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
              {data.users
                .filter((u) => u.state === 'active')
                .map((u) => (
                  <div key={u.id} className="flex items-center justify-between gap-2 px-1 text-[11px]">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${PRESENCE_DOT[u.presence || 'active']}`} />
                      <span className="truncate text-[#111215] dark:text-[#E5E7EB]">{u.displayName}</span>
                    </span>
                    <span className="text-[10px] font-mono text-[#5E6572] dark:text-[#9CA3AF] capitalize shrink-0">
                      {u.presence || 'active'}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </aside>

        {/* Center Message Feed */}
        <section
          className={`${
            threadParent ? 'lg:col-span-6' : 'lg:col-span-9'
          } flex flex-col min-w-0`}
        >
          {/* Channel Header */}
          {activeChannel && (
            <div className="px-4 sm:px-5 py-3.5 border-b border-[#E5E7EB] dark:border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-[#111215] dark:text-white flex items-center gap-1">
                    {activeChannel.isPrivate ? <Lock className="w-3.5 h-3.5" /> : <Hash className="w-3.5 h-3.5" />}
                    {activeChannel.name}
                  </span>
                  {activeChannel.projectId && (
                    <span className="font-mono text-[11px] text-[#5E6572] dark:text-[#9CA3AF]">
                      · {data.projects.find((p) => p.id === activeChannel.projectId)?.key}
                    </span>
                  )}
                  {firestoreLiveCount !== null && (
                    <span className="text-[11px] font-mono text-[#1F764D] dark:text-[#6EE7B7]">
                      · Synced
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#5E6572] dark:text-[#9CA3AF] truncate mt-0.5">
                  {activeChannel.topic || 'Engineering collaboration channel'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Per-Channel Alert Override */}
                <select
                  aria-label={`Notification preference for #${activeChannel.name}`}
                  value={effectiveNotifMode}
                  onChange={(e) => handleUpdateNotifMode(e.target.value as ChatNotificationMode, 'channel')}
                  className="h-8 px-2.5 text-[11px] bg-[#F8F9FA] dark:bg-[#14171E] text-[#111215] dark:text-[#E5E7EB] border border-[#D8DCE3] dark:border-white/[0.1] rounded-lg"
                >
                  <option value="mentions_only">Channel: Mentions Only</option>
                  <option value="all_messages">Channel: All Messages</option>
                  <option value="muted">Channel: Muted</option>
                </select>

                {/* View Filter Tabs */}
                <div className="flex items-center bg-[#F3F4F6] dark:bg-[#14171E] rounded-lg p-0.5 border border-[#E5E7EB] dark:border-white/[0.08] text-[11px]">
                  {(['all', 'mentions', 'pinned'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setFilterMode(m)}
                      className={`px-2.5 py-1 rounded-md capitalize ${
                        filterMode === m
                          ? 'bg-[#111215] dark:bg-white text-white dark:text-[#0B0C0E] font-medium'
                          : 'text-[#5E6572] dark:text-[#9CA3AF]'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>

                {/* Search Input */}
                <div className="relative">
                  <Search className="w-3 h-3 text-[#5E6572] dark:text-[#9CA3AF] absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter chat…"
                    aria-label="Filter channel messages"
                    className="h-8 w-36 pl-7 pr-2.5 text-xs bg-white dark:bg-[#161922] border border-[#D8DCE3] dark:border-white/[0.12] rounded-lg"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Pinned Banner */}
          {pinnedMessages.length > 0 && filterMode !== 'pinned' && (
            <div className="px-4 sm:px-5 py-2 bg-[#F8F9FA] dark:bg-[#14171D] border-b border-[#EFF1F4] dark:border-[#1B1F28] flex items-center justify-between gap-2 text-[11px] text-[#5E6572] dark:text-[#9CA3AF]">
              <span className="flex items-center gap-1.5 truncate">
                <Pin className="w-3 h-3 text-[#111215] dark:text-[#F3F4F6] shrink-0" />
                <span className="truncate">
                  <strong className="text-[#111215] dark:text-[#F3F4F6]">Pinned:</strong> {pinnedMessages[0].body}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setFilterMode('pinned')}
                className="font-medium text-[#111215] dark:text-[#F3F4F6] hover:underline shrink-0"
              >
                View ({pinnedMessages.length})
              </button>
            </div>
          )}

          {/* Message List */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 max-h-[460px]">
            {channelMessages.map((msg) => {
              const author = getUser(msg.authorId);
              const replyCount = data.chatMessages.filter((r) => r.parentMessageId === msg.id).length;
              const isOwn = msg.authorId === data.currentUser.id;
              const canModerate =
                isOwn ||
                data.currentUser.role === 'Workspace Owner' ||
                data.currentUser.role === 'Workspace Administrator';
              const isEditing = editingMsgId === msg.id;

              return (
                <div
                  key={msg.id}
                  className={`group rounded-xl p-3 transition-colors ${
                    msg.pinned
                      ? 'bg-[#F8F9FA] dark:bg-[#161922] border border-[#E2E5EA] dark:border-white/[0.08]'
                      : 'hover:bg-[#F8F9FA] dark:hover:bg-white/[0.03]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="relative shrink-0 mt-0.5">
                      <UserAvatar name={author?.displayName || 'User'} />
                      <span
                        className={`w-2.5 h-2.5 rounded-full border-2 border-white dark:border-[#0E1014] absolute -bottom-0.5 -right-0.5 ${
                          PRESENCE_DOT[author?.presence || 'active']
                        }`}
                      />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-semibold text-[#111215] dark:text-[#F3F4F6]">
                            {author?.displayName || 'Unknown'}
                          </span>
                          <span className="text-[10px] font-mono text-[#5E6572] dark:text-[#9CA3AF]">
                            {author?.role}
                          </span>
                          <span className="text-[11px] font-mono text-[#7D8490] dark:text-[#6B7280] tabular-nums">
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {msg.edited && (
                            <span className="text-[10px] text-[#5E6572] dark:text-[#9CA3AF]">(edited)</span>
                          )}
                          {msg.pinned && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-[#9B6B08] dark:text-[#FCD34D]">
                              <Pin className="w-2.5 h-2.5" /> Pinned
                            </span>
                          )}
                        </div>

                        {/* Quick Message Controls */}
                        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => setThreadParentId(msg.id)}
                            title="Reply in thread"
                            className="h-6 px-2 rounded-md border border-[#E2E5EA] dark:border-white/[0.1] bg-white dark:bg-[#161922] text-[10px] text-[#5E6572] dark:text-[#9CA3AF] hover:text-[#111215] dark:hover:text-white"
                          >
                            Reply
                          </button>
                          <button
                            type="button"
                            onClick={() => onPromoteToWorkPackage(msg.body.slice(0, 80), `Promoted from #${activeChannel?.name || 'chat'}:\n\n${msg.body}`)}
                            title="Promote to Work Package"
                            className="h-6 px-2 rounded-md border border-[#E2E5EA] dark:border-white/[0.1] bg-white dark:bg-[#161922] text-[10px] text-[#5E6572] dark:text-[#9CA3AF] hover:text-[#111215] dark:hover:text-white inline-flex items-center gap-1"
                          >
                            <Sparkles className="w-2.5 h-2.5" />
                            <span className="hidden sm:inline">Task</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(msg.body).catch(() => {});
                              onNotify('info', 'Message copied to clipboard');
                            }}
                            title="Copy message"
                            className="w-6 h-6 rounded-md border border-[#E2E5EA] dark:border-white/[0.1] bg-white dark:bg-[#161922] flex items-center justify-center text-[#5E6572] dark:text-[#9CA3AF]"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                          {canModerate && (
                            <>
                              <button
                                type="button"
                                onClick={async () => {
                                  await api.updateChatMessage(msg.id, { pinned: !msg.pinned });
                                  await onRefresh();
                                }}
                                title={msg.pinned ? 'Unpin' : 'Pin'}
                                className="w-6 h-6 rounded-md border border-[#E2E5EA] dark:border-white/[0.1] bg-white dark:bg-[#161922] flex items-center justify-center text-[#5E6572] dark:text-[#9CA3AF]"
                              >
                                <Pin className="w-3 h-3" />
                              </button>
                              {isOwn && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingMsgId(msg.id);
                                    setEditingBody(msg.body);
                                  }}
                                  title="Edit message"
                                  className="w-6 h-6 rounded-md border border-[#E2E5EA] dark:border-white/[0.1] bg-white dark:bg-[#161922] flex items-center justify-center text-[#5E6572] dark:text-[#9CA3AF]"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setDeleteTargetId(msg.id)}
                                title="Delete message"
                                className="w-6 h-6 rounded-md border border-[#F5C6C2] dark:border-red-500/30 bg-white dark:bg-[#161922] flex items-center justify-center text-[#B42318] dark:text-red-300"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {isEditing ? (
                        <div className="space-y-2">
                          <textarea
                            rows={2}
                            value={editingBody}
                            onChange={(e) => setEditingBody(e.target.value)}
                            className="w-full p-2.5 text-xs bg-white dark:bg-[#161922] border border-[#D8DCE3] dark:border-white/[0.12] rounded-lg"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={async () => {
                                await api.updateChatMessage(msg.id, { body: editingBody });
                                setEditingMsgId(null);
                                await onRefresh();
                              }}
                              className="h-7 px-3 rounded-lg bg-[#111215] dark:bg-white text-white dark:text-[#0B0C0E] text-[11px] font-medium inline-flex items-center gap-1"
                            >
                              <Check className="w-3 h-3" /> Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingMsgId(null)}
                              className="h-7 px-3 rounded-lg border border-[#D8DCE3] dark:border-white/[0.12] text-[11px]"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-[#111215] dark:text-[#E5E7EB] leading-relaxed whitespace-pre-wrap break-words">
                          {renderRichBody(msg.body)}
                        </p>
                      )}

                      {/* Reactions & Thread Trigger */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        {(['👍', '✅', '👀', '🚀', 'ACK'] as const).map((label) => {
                          const users = msg.reactions[label] || [];
                          const active = users.includes(data.currentUser.id);
                          return (
                            <button
                              key={label}
                              type="button"
                              onClick={async () => {
                                await api.reactChatMessage(msg.id, label);
                                await onRefresh();
                              }}
                              className={`px-2 py-0.5 rounded-md border text-[11px] font-mono transition-colors ${
                                active
                                  ? 'bg-[#111215] dark:bg-white text-white dark:text-[#0B0C0E] border-[#111215] dark:border-white'
                                  : users.length > 0
                                  ? 'bg-white dark:bg-[#161922] text-[#111215] dark:text-[#E5E7EB] border-[#D8DCE3] dark:border-white/[0.12]'
                                  : 'bg-transparent border-transparent text-[#5E6572] dark:text-[#9CA3AF] opacity-60 hover:opacity-100 hover:border-[#D8DCE3] dark:hover:border-white/[0.12]'
                              }`}
                            >
                              {label} {users.length > 0 ? users.length : ''}
                            </button>
                          );
                        })}

                        {replyCount > 0 && (
                          <button
                            type="button"
                            onClick={() => setThreadParentId(msg.id)}
                            className="ml-1 px-2.5 py-0.5 rounded-md bg-[#ECEEF2] dark:bg-[#161922] border border-transparent dark:border-white/[0.08] text-[11px] font-medium text-[#111215] dark:text-[#F3F4F6] inline-flex items-center gap-1 hover:underline"
                          >
                            <MessageSquare className="w-3 h-3" />
                            <span>
                              {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
                            </span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {channelMessages.length === 0 && (
              <div className="py-12 text-center text-xs text-[#5E6572] dark:text-[#9CA3AF]">
                No messages match this view yet. Mention <code className="font-mono">@teammate</code> or link a Work
                Package like <code className="font-mono">#CTRL-102</code> below.
              </div>
            )}
            <div ref={endOfListRef} />
          </div>

          {/* Composer */}
          {canWrite && activeChannel && (
            <form
              onSubmit={(e) => handleSendMessage(e, null)}
              className="p-3.5 border-t border-[#E2E5EA] dark:border-white/[0.08] bg-[#F8F9FA] dark:bg-[#0D0F13] relative"
            >
              {/* @mention autocomplete popup */}
              {mentionSuggestions.length > 0 && (
                <div className="absolute bottom-full left-3.5 mb-2 w-64 bg-white dark:bg-[#111318] border border-[#E2E5EA] dark:border-white/[0.1] rounded-xl shadow-xl p-1.5 z-20">
                  <div className="px-2.5 py-1 text-[10px] font-semibold text-[#5E6572] dark:text-[#9CA3AF]">
                    Mention Teammate
                  </div>
                  {mentionSuggestions.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => insertAutocomplete(`@${u.displayName.split(' ')[0]}`, '@')}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[#F3F4F6] dark:hover:bg-white/[0.06] flex items-center justify-between gap-2 text-xs"
                    >
                      <span className="font-medium text-[#111215] dark:text-[#F3F4F6]">{u.displayName}</span>
                      <span className="text-[10px] font-mono text-[#5E6572] dark:text-[#9CA3AF]">{u.role}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => insertAutocomplete('@channel', '@')}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[#F3F4F6] dark:hover:bg-white/[0.06] flex items-center justify-between gap-2 text-xs border-t border-[#EFF1F4] dark:border-white/[0.06] mt-1 pt-1.5"
                  >
                    <span className="font-mono font-semibold text-[#111215] dark:text-[#F3F4F6]">@channel</span>
                    <span className="text-[10px] text-[#5E6572] dark:text-[#9CA3AF]">Notify opted-in members</span>
                  </button>
                </div>
              )}

              {/* #WorkPackage autocomplete popup */}
              {workKeySuggestions.length > 0 && (
                <div className="absolute bottom-full left-3.5 mb-2 w-80 bg-white dark:bg-[#111318] border border-[#E2E5EA] dark:border-white/[0.1] rounded-xl shadow-xl p-1.5 z-20">
                  <div className="px-2.5 py-1 text-[10px] font-semibold text-[#5E6572] dark:text-[#9CA3AF]">
                    Link Work Package
                  </div>
                  {workKeySuggestions.map((wp) => (
                    <button
                      key={wp.id}
                      type="button"
                      onClick={() => insertAutocomplete(`#${wp.key}`, '#')}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[#F3F4F6] dark:hover:bg-white/[0.06] flex items-center gap-2 text-xs"
                    >
                      <span className="font-mono font-semibold text-[#111215] dark:text-[#F3F4F6] shrink-0">{wp.key}</span>
                      <span className="truncate text-[#5E6572] dark:text-[#9CA3AF]">{wp.title}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-end gap-2">
                <textarea
                  ref={composerRef}
                  rows={2}
                  maxLength={4000}
                  value={composer}
                  onChange={(e) => setComposer(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void handleSendMessage(undefined, null);
                    }
                  }}
                  placeholder={`Message #${activeChannel.name} — type @ to mention or # to link a Work Package…`}
                  className="flex-1 p-3 text-sm sm:text-xs bg-white dark:bg-[#111318] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-xl resize-none"
                />
                <button
                  type="submit"
                  disabled={sending || !composer.trim()}
                  aria-label="Send chat message"
                  className="h-10 px-4 bg-[#111215] hover:bg-[#262930] dark:bg-white dark:hover:bg-[#E5E7EB] disabled:opacity-40 text-white dark:text-[#0B0C0E] rounded-lg text-xs font-medium inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Send</span>
                </button>
              </div>
              <div className="flex items-center justify-between mt-1.5 px-1 text-[10px] text-[#5E6572] dark:text-[#9CA3AF]">
                <span>Enter to send · Shift+Enter for newline · Alerts mode: {effectiveNotifMode.replace('_', ' ')}</span>
                <span className="font-mono tabular-nums">{composer.length}/4000</span>
              </div>
            </form>
          )}
        </section>

        {/* Thread Panel */}
        {threadParent && (
          <aside className="lg:col-span-3 border-t lg:border-t-0 lg:border-l border-[#E2E5EA] dark:border-white/[0.08] bg-[#F8F9FA] dark:bg-[#0D0F13] flex flex-col">
            <div className="px-4 py-3.5 border-b border-[#E2E5EA] dark:border-white/[0.08] flex items-center justify-between">
              <span className="text-xs font-semibold text-[#111215] dark:text-[#F3F4F6]">
                Thread ({threadReplies.length})
              </span>
              <button
                type="button"
                onClick={() => setThreadParentId(null)}
                aria-label="Close thread"
                className="w-7 h-7 rounded-lg hover:bg-[#ECEEF2] dark:hover:bg-white/[0.06] flex items-center justify-center"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[420px]">
              <div className="p-3 rounded-xl bg-white dark:bg-[#111318] border border-[#E2E5EA] dark:border-white/[0.08] space-y-1">
                <div className="text-[11px] font-semibold text-[#111215] dark:text-[#F3F4F6]">
                  {getUser(threadParent.authorId)?.displayName}
                </div>
                <p className="text-xs text-[#111215] dark:text-[#E5E7EB]">{renderRichBody(threadParent.body)}</p>
              </div>
              {threadReplies.map((r) => (
                <div key={r.id} className="p-2.5 rounded-xl bg-white/70 dark:bg-[#111318]/70 border border-[#EFF1F4] dark:border-white/[0.06] space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-[#111215] dark:text-[#F3F4F6]">
                      {getUser(r.authorId)?.displayName}
                    </span>
                    <span className="font-mono text-[10px] text-[#5E6572] dark:text-[#9CA3AF]">
                      {new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs text-[#111215] dark:text-[#E5E7EB]">{renderRichBody(r.body)}</p>
                </div>
              ))}
            </div>
            {canWrite && (
              <form
                onSubmit={(e) => handleSendMessage(e, threadParent.id)}
                className="p-3 border-t border-[#E2E5EA] dark:border-white/[0.08] flex items-center gap-2"
              >
                <input
                  type="text"
                  value={threadReply}
                  onChange={(e) => setThreadReply(e.target.value)}
                  placeholder="Reply in thread…"
                  className="flex-1 h-9 px-3 text-xs bg-white dark:bg-[#111318] border border-[#D8DCE3] dark:border-white/[0.12] rounded-lg"
                />
                <button
                  type="submit"
                  disabled={!threadReply.trim() || sending}
                  className="h-9 px-3 bg-[#111215] dark:bg-white text-white dark:text-[#0B0C0E] rounded-lg text-xs font-medium disabled:opacity-40"
                >
                  Send
                </button>
              </form>
            )}
          </aside>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(deleteTargetId)}
        title="Delete workspace message?"
        description="This permanently removes the message and any replies in its thread."
        confirmLabel="Delete Message"
        destructive
        onCancel={() => setDeleteTargetId(null)}
        onConfirm={async () => {
          if (!deleteTargetId) return;
          await api.deleteChatMessage(deleteTargetId);
          setDeleteTargetId(null);
          await onRefresh();
          onNotify('info', 'Message deleted');
        }}
      />
    </div>
  );
}
