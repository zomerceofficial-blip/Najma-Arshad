import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  AtSign,
  Bell,
  BellOff,
  CheckCircle2,
  Info,
  Keyboard,
  ShieldAlert,
  X,
} from 'lucide-react';
import type { ChatNotificationMode, User, UserPresence } from '../types/workspace.ts';
import { api } from '../lib/api.ts';
import { syncFirebaseUserProfile } from '../lib/firebase.ts';

export interface ToastMessage {
  id: string;
  tone: 'success' | 'error' | 'info';
  title: string;
  detail?: string;
}

export function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div
      aria-live="polite"
      className="fixed bottom-20 lg:bottom-5 right-4 z-50 flex flex-col gap-2 w-[calc(100vw-2rem)] max-w-sm pointer-events-none"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className="pointer-events-auto bg-white dark:bg-[#111318] border border-[#E2E5EA] dark:border-white/[0.1] rounded-xl p-3.5 shadow-[0_12px_32px_rgba(11,12,14,0.14)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.65)] flex items-start gap-3"
        >
          <div className="mt-0.5 shrink-0">
            {t.tone === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-[#1F764D] dark:text-emerald-400" />
            ) : t.tone === 'error' ? (
              <ShieldAlert className="w-4 h-4 text-[#B42318] dark:text-red-400" />
            ) : (
              <Info className="w-4 h-4 text-[#111215] dark:text-white" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-[#111215] dark:text-white">{t.title}</div>
            {t.detail && <div className="text-[11px] text-[#5E6572] dark:text-[#9CA3AF] mt-0.5 break-words">{t.detail}</div>}
          </div>
          <button
            type="button"
            onClick={() => onDismiss(t.id)}
            aria-label="Dismiss notification"
            className="w-6 h-6 rounded-md hover:bg-[#F3F4F6] dark:hover:bg-white/[0.06] flex items-center justify-center text-[#5E6572] dark:text-[#9CA3AF] shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  destructive = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B0C0E]/55 dark:bg-black/75 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-md bg-white dark:bg-[#111318] border border-[#E2E5EA] dark:border-white/[0.1] rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="flex items-start gap-3">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              destructive
                ? 'bg-[#FEF0EE] dark:bg-red-500/10 text-[#B42318] dark:text-red-300 border border-[#F5C6C2] dark:border-red-500/25'
                : 'bg-[#F3F4F6] dark:bg-[#161922] text-[#111215] dark:text-white border border-[#E2E5EA] dark:border-white/[0.1]'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-sm font-semibold text-[#111215] dark:text-white">{title}</h2>
            <p className="text-xs text-[#5E6572] dark:text-[#9CA3AF] mt-1 leading-relaxed">{description}</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="h-9 px-4 border border-[#D8DCE3] dark:border-white/[0.12] rounded-lg text-xs font-medium text-[#111215] dark:text-[#E5E7EB]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
              } finally {
                setBusy(false);
              }
            }}
            className={`h-9 px-5 rounded-lg text-xs font-medium disabled:opacity-50 ${
              destructive
                ? 'bg-[#B42318] hover:bg-[#911B12] text-white'
                : 'bg-[#111215] dark:bg-white text-white dark:text-[#0B0C0E]'
            }`}
          >
            {busy ? 'Processing…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function KeyboardShortcutsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  const shortcuts = [
    { keys: '⌘K / Ctrl+K', desc: 'Open global command palette & quick jump' },
    { keys: 'C', desc: 'Create a new Work Package (when outside inputs)' },
    { keys: 'G then C', desc: 'Jump directly to Workspace Chat' },
    { keys: 'G then O', desc: 'Jump directly to Overview' },
    { keys: '?', desc: 'Toggle this keyboard shortcut reference' },
    { keys: 'Esc', desc: 'Close active drawer, palette, or modal' },
  ];
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B0C0E]/55 dark:bg-black/75 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <div className="w-full max-w-md bg-white dark:bg-[#111318] border border-[#E2E5EA] dark:border-white/[0.1] rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-[#111215] dark:text-white" />
            <h2 className="font-display text-sm font-semibold text-[#111215] dark:text-white">
              Workspace Keyboard Shortcuts
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close shortcuts"
            className="w-8 h-8 rounded-lg border border-[#E2E5EA] dark:border-white/[0.12] flex items-center justify-center text-[#5E6572] dark:text-[#9CA3AF]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="divide-y divide-[#EFF1F4] dark:divide-white/[0.06]">
          {shortcuts.map((s) => (
            <div key={s.keys} className="py-2.5 flex items-center justify-between gap-4 text-xs">
              <span className="text-[#5E6572] dark:text-[#9CA3AF]">{s.desc}</span>
              <kbd className="px-2 py-0.5 rounded-md bg-[#F3F4F6] dark:bg-[#161922] border border-[#D8DCE3] dark:border-white/[0.12] font-mono text-[11px] text-[#111215] dark:text-[#F3F4F6] shrink-0">
                {s.keys}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function UserPreferencesModal({
  open,
  user,
  onClose,
  onSaved,
  onNotify,
}: {
  open: boolean;
  user: User;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onNotify: (tone: ToastMessage['tone'], title: string, detail?: string) => void;
}) {
  const [presence, setPresence] = useState<UserPresence>(user.presence || 'active');
  const [chatMode, setChatMode] = useState<ChatNotificationMode>(user.chatNotificationMode || 'mentions_only');
  const [notifyChannelAll, setNotifyChannelAll] = useState<boolean>(user.notifyOnChannelAll !== false);
  const [desktopAlerts, setDesktopAlerts] = useState<boolean>(Boolean(user.desktopAlerts));
  const [timezone, setTimezone] = useState<string>(user.timezone || 'UTC');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPresence(user.presence || 'active');
    setChatMode(user.chatNotificationMode || 'mentions_only');
    setNotifyChannelAll(user.notifyOnChannelAll !== false);
    setDesktopAlerts(Boolean(user.desktopAlerts));
    setTimezone(user.timezone || 'UTC');
  }, [user, open]);

  if (!open) return null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updatePreferences({
        presence,
        chatNotificationMode: chatMode,
        notifyOnChannelAll: notifyChannelAll,
        desktopAlerts,
        timezone,
      });
      if (user.authProvider === 'firebase') {
        await syncFirebaseUserProfile({
          displayName: user.displayName,
          title: user.title,
          presence,
          email: user.email,
          chatNotificationMode: chatMode,
          notifyOnChannelAll: notifyChannelAll,
          desktopAlerts,
          timezone,
        });
      }
      await onSaved();
      onNotify(
        'success',
        'Notification & presence preferences updated',
        chatMode === 'mentions_only'
          ? 'You will only be alerted when @mentioned or replied to.'
          : chatMode === 'all_messages'
          ? 'You will receive alerts for every message in accessible channels.'
          : 'Workspace chat notifications are muted.'
      );
      onClose();
    } catch (err) {
      onNotify('error', 'Failed to save preferences', err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B0C0E]/55 dark:bg-black/75 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Notification and presence settings"
    >
      <form
        onSubmit={handleSave}
        className="w-full max-w-lg bg-white dark:bg-[#111318] border border-[#E2E5EA] dark:border-white/[0.1] rounded-2xl p-6 shadow-2xl space-y-5"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-[#111215] dark:text-white">
              Personal Presence & Chat Notification Rules
            </h2>
            <p className="text-xs text-[#5E6572] dark:text-[#9CA3AF] mt-0.5">
              Signed in via <span className="font-mono capitalize">{user.authProvider}</span> · {user.email}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preferences"
            className="w-8 h-8 rounded-lg border border-[#E2E5EA] dark:border-white/[0.12] flex items-center justify-center text-[#5E6572] dark:text-[#9CA3AF]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-semibold text-[#111215] dark:text-white">
            Workspace Presence
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(
              [
                { key: 'active', label: 'Active', dot: 'bg-[#1F764D]' },
                { key: 'focus', label: 'Deep Focus', dot: 'bg-[#2563EB]' },
                { key: 'reviewing', label: 'Reviewing', dot: 'bg-[#9B6B08]' },
                { key: 'away', label: 'Away', dot: 'bg-[#6B7280]' },
              ] as const
            ).map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPresence(p.key)}
                className={`h-9 px-3 rounded-lg border text-xs font-medium flex items-center justify-center gap-2 transition-colors ${
                  presence === p.key
                    ? 'bg-[#111215] dark:bg-white text-white dark:text-[#0B0C0E] border-[#111215] dark:border-white'
                    : 'bg-[#F8F9FA] dark:bg-[#161922] text-[#111215] dark:text-[#E5E7EB] border-[#D8DCE3] dark:border-white/[0.12]'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${p.dot}`} />
                <span>{p.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-semibold text-[#111215] dark:text-white">
            Workspace Chat Notification Rule
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {(
              [
                {
                  key: 'mentions_only',
                  label: 'Mentions Only',
                  desc: 'Only @mentions & thread replies',
                  icon: AtSign,
                },
                {
                  key: 'all_messages',
                  label: 'All Messages',
                  desc: 'Every message in your channels',
                  icon: Bell,
                },
                {
                  key: 'muted',
                  label: 'Muted',
                  desc: 'Suppress non-security chat alerts',
                  icon: BellOff,
                },
              ] as const
            ).map((opt) => {
              const Icon = opt.icon;
              const selected = chatMode === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setChatMode(opt.key)}
                  className={`p-3 rounded-xl border text-left transition-colors ${
                    selected
                      ? 'bg-[#111215] dark:bg-white text-white dark:text-[#0B0C0E] border-[#111215] dark:border-white'
                      : 'bg-[#F8F9FA] dark:bg-[#161922] text-[#111215] dark:text-[#E5E7EB] border-[#D8DCE3] dark:border-white/[0.12]'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    <Icon className="w-3.5 h-3.5" />
                    <span>{opt.label}</span>
                  </div>
                  <p className={`text-[11px] mt-1 ${selected ? 'opacity-80' : 'text-[#5E6572] dark:text-[#9CA3AF]'}`}>
                    {opt.desc}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2.5 pt-1">
          <label className="flex items-center gap-2.5 text-xs text-[#111215] dark:text-[#E5E7EB] cursor-pointer">
            <input
              type="checkbox"
              checked={notifyChannelAll}
              onChange={(e) => setNotifyChannelAll(e.target.checked)}
            />
            <span>Notify me on <code className="font-mono">@channel</code> and <code className="font-mono">@all</code> broadcasts</span>
          </label>
          <label className="flex items-center gap-2.5 text-xs text-[#111215] dark:text-[#E5E7EB] cursor-pointer">
            <input
              type="checkbox"
              checked={desktopAlerts}
              onChange={(e) => setDesktopAlerts(e.target.checked)}
            />
            <span>Play subtle in-app toast alert when new chat mentions arrive</span>
          </label>
        </div>

        <div>
          <label className="block text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mb-1">Timezone</label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full h-10 px-3 text-xs bg-white dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-lg"
          >
            <option value="UTC">UTC</option>
            <option value="America/Los_Angeles">America/Los_Angeles</option>
            <option value="America/New_York">America/New_York</option>
            <option value="Europe/London">Europe/London</option>
            <option value="Europe/Stockholm">Europe/Stockholm</option>
            <option value="Asia/Tokyo">Asia/Tokyo</option>
          </select>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 border border-[#D8DCE3] dark:border-white/[0.12] rounded-lg text-xs text-[#111215] dark:text-[#E5E7EB]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="h-9 px-5 bg-[#111215] dark:bg-white text-white dark:text-[#0B0C0E] rounded-lg text-xs font-medium disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Preferences'}
          </button>
        </div>
      </form>
    </div>
  );
}
