import { useEffect, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  FolderKanban,
  Layers,
  LayoutDashboard,
  MessageSquare,
  Search,
  Users,
  X,
} from 'lucide-react';
import { api, type SearchResults } from '../lib/api.ts';
import type { WorkPackage } from '../types/workspace.ts';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onSelectWorkPackage: (wp: WorkPackage) => void;
  onNavigate: (section: string, projectId?: string) => void;
}

const QUICK_JUMPS = [
  { key: 'overview', label: 'Programme Overview', shortcut: 'G O', icon: LayoutDashboard },
  { key: 'chat', label: 'Engineering Chat', shortcut: 'G C', icon: MessageSquare },
  { key: 'work-packages', label: 'All Work Packages', shortcut: 'C', icon: Layers },
  { key: 'members', label: 'Account Directory (8 Slots)', shortcut: '', icon: Users },
];

export function CommandPalette({
  open,
  onClose,
  onSelectWorkPackage,
  onNavigate,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults>({
    projects: [],
    workPackages: [],
    documents: [],
    users: [],
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    if (!query.trim()) {
      setResults({ projects: [], workPackages: [], documents: [], users: [] });
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.search(query);
        setResults(res);
      } catch {
        // ignore transient search errors
      } finally {
        setLoading(false);
      }
    }, 120);
    return () => clearTimeout(timer);
  }, [query, open]);

  if (!open) return null;

  const hasAny =
    results.projects.length > 0 ||
    results.workPackages.length > 0 ||
    results.documents.length > 0 ||
    results.users.length > 0;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-center pt-6 sm:pt-24 bg-black/50 dark:bg-black/75 backdrop-blur-xs p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Workspace command palette"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[620px] bg-white dark:bg-[#111318] border border-[#E5E7EB] dark:border-white/[0.1] rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.28)] overflow-hidden"
      >
        <div className="px-4 py-3.5 border-b border-[#E5E7EB] dark:border-white/[0.08] flex items-center gap-3">
          <Search className="w-4 h-4 text-[#5E6572] dark:text-[#9CA3AF] shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump to view or search keys, ADRs, projects, members…"
            className="flex-1 text-base sm:text-sm bg-transparent text-[#111215] dark:text-white placeholder:text-[#5E6572] dark:placeholder:text-[#6B7280] focus:outline-none min-w-0"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="w-7 h-7 rounded-lg hover:bg-[#F3F4F6] dark:hover:bg-white/[0.08] flex items-center justify-center text-[#5E6572] dark:text-[#9CA3AF] hover:text-[#111215] dark:hover:text-white shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[70dvh] sm:max-h-[420px] overflow-y-auto divide-y divide-[#F1F3F5] dark:divide-white/[0.06]">
          {!query.trim() && (
            <div className="p-2.5 space-y-1">
              <div className="px-3 py-1 text-[11px] font-medium text-[#5E6572] dark:text-[#9CA3AF]">
                Quick Jump
              </div>
              {QUICK_JUMPS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      onNavigate(item.key);
                      onClose();
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-[#F4F5F7] dark:hover:bg-white/[0.06] flex items-center justify-between text-xs transition-colors"
                  >
                    <span className="flex items-center gap-2.5 text-[#111215] dark:text-[#E5E7EB] font-medium">
                      <Icon className="w-3.5 h-3.5 text-[#5E6572] dark:text-[#9CA3AF]" />
                      <span>{item.label}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      {item.shortcut && (
                        <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-[#F3F4F6] dark:bg-white/[0.08] text-[#5E6572] dark:text-[#9CA3AF] rounded">
                          {item.shortcut}
                        </kbd>
                      )}
                      <ArrowRight className="w-3 h-3 text-[#9CA3AF]" />
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {loading && <div className="p-4 text-xs text-[#5E6572] dark:text-[#9CA3AF]">Searching workspace…</div>}

          {query.trim() && !loading && !hasAny && (
            <div className="p-6 text-xs text-[#5E6572] dark:text-[#9CA3AF]">No authorized results found for "{query}".</div>
          )}

          {results.workPackages.length > 0 && (
            <div className="p-2">
              <div className="px-3 py-1 text-[11px] font-medium text-[#5E6572] dark:text-[#9CA3AF]">Work Packages</div>
              {results.workPackages.map((wp) => (
                <button
                  key={wp.id}
                  type="button"
                  onClick={() => {
                    onSelectWorkPackage(wp);
                    onClose();
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#F4F5F7] dark:hover:bg-white/[0.06] flex items-center justify-between text-xs gap-2"
                >
                  <span className="truncate">
                    <span className="font-mono font-semibold text-[#111215] dark:text-white mr-2">{wp.key}</span>
                    <span className="text-[#111215] dark:text-[#E5E7EB]">{wp.title}</span>
                  </span>
                  <span className="text-[#5E6572] dark:text-[#9CA3AF] shrink-0">{wp.status}</span>
                </button>
              ))}
            </div>
          )}

          {results.projects.length > 0 && (
            <div className="p-2">
              <div className="px-3 py-1 text-[11px] font-medium text-[#5E6572] dark:text-[#9CA3AF]">Projects</div>
              {results.projects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onNavigate('projects', p.id);
                    onClose();
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#F4F5F7] dark:hover:bg-white/[0.06] flex items-center gap-2 text-xs"
                >
                  <FolderKanban className="w-3.5 h-3.5 text-[#111215] dark:text-[#D8D8D8] shrink-0" />
                  <span className="font-mono font-semibold text-[#111215] dark:text-white">{p.key}</span>
                  <span className="text-[#111215] dark:text-[#E5E7EB] truncate">{p.name}</span>
                </button>
              ))}
            </div>
          )}

          {results.documents.length > 0 && (
            <div className="p-2">
              <div className="px-3 py-1 text-[11px] font-medium text-[#5E6572] dark:text-[#9CA3AF]">Documents & ADRs</div>
              {results.documents.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => {
                    onNavigate('documents');
                    onClose();
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#F4F5F7] dark:hover:bg-white/[0.06] flex items-center gap-2 text-xs"
                >
                  <BookOpen className="w-3.5 h-3.5 text-[#111215] dark:text-[#D8D8D8] shrink-0" />
                  <span className="font-mono text-[#5E6572] dark:text-[#9CA3AF]">{doc.category}</span>
                  <span className="text-[#111215] dark:text-[#E5E7EB] truncate">{doc.title}</span>
                </button>
              ))}
            </div>
          )}

          {results.users.length > 0 && (
            <div className="p-2">
              <div className="px-3 py-1 text-[11px] font-medium text-[#5E6572] dark:text-[#9CA3AF]">Directory Accounts</div>
              {results.users.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => {
                    onNavigate('members');
                    onClose();
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#F4F5F7] dark:hover:bg-white/[0.06] flex items-center justify-between text-xs gap-2"
                >
                  <span className="flex items-center gap-2 truncate">
                    <Users className="w-3.5 h-3.5 text-[#111215] dark:text-[#D8D8D8] shrink-0" />
                    <span className="font-medium text-[#111215] dark:text-white truncate">{u.displayName}</span>
                  </span>
                  <span className="text-[#5E6572] dark:text-[#9CA3AF] shrink-0">{u.role}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
