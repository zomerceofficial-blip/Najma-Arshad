import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  Calendar,
  CheckSquare,
  ChevronDown,
  FileText,
  FolderKanban,
  GanttChartSquare,
  GitBranch,
  GitMerge,
  HelpCircle,
  Inbox,
  Kanban,
  Keyboard,
  Layers,
  LayoutDashboard,
  Library,
  ListTodo,
  LogOut,
  Menu,
  MessageSquare,
  Milestone,
  Moon,
  Paperclip,
  PlayCircle,
  Plug,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  Tag,
  UserCheck,
  Users,
  Video,
  WifiOff,
  X,
} from 'lucide-react';
import { api, setAuthToken, setUnauthorizedHandler, type WorkspaceBootstrapData } from './lib/api.ts';
import type { AuthSessionResponse, WorkPackage } from './types/workspace.ts';
import { AuthScreen } from './components/AuthScreen.tsx';
import { OverviewDashboard } from './components/OverviewDashboard.tsx';
import { WorkViews } from './components/WorkViews.tsx';
import { WorkPackageDrawer } from './components/WorkPackageDrawer.tsx';
import { KnowledgeAndCollab } from './components/KnowledgeAndCollab.tsx';
import { EngineeringViews } from './components/EngineeringViews.tsx';
import { OrganizationAndAdmin } from './components/OrganizationAndAdmin.tsx';
import { CreateWorkPackageModal } from './components/CreateWorkPackageModal.tsx';
import { CommandPalette } from './components/CommandPalette.tsx';
import { UserAvatar } from './components/StatusLabel.tsx';
import {
  KeyboardShortcutsModal,
  ToastStack,
  UserPreferencesModal,
  type ToastMessage,
} from './components/ToastAndDialogs.tsx';

type NavKey =
  | 'overview'
  | 'my-work'
  | 'activity'
  | 'inbox'
  | 'projects'
  | 'work-packages'
  | 'boards'
  | 'backlog'
  | 'gantt'
  | 'roadmap'
  | 'calendar'
  | 'reports'
  | 'chat'
  | 'meetings'
  | 'documents'
  | 'knowledge'
  | 'files'
  | 'repositories'
  | 'merge-requests'
  | 'pipelines'
  | 'releases'
  | 'teams'
  | 'members'
  | 'workload'
  | 'settings'
  | 'roles'
  | 'integrations'
  | 'audit';

const NAV_TITLES: Record<NavKey, { group: string; label: string }> = {
  overview: { group: 'Workspace', label: 'Programme Overview' },
  'my-work': { group: 'Workspace', label: 'My Work' },
  activity: { group: 'Workspace', label: 'Activity Stream' },
  inbox: { group: 'Workspace', label: 'Inbox & Notifications' },
  projects: { group: 'Delivery', label: 'Projects' },
  'work-packages': { group: 'Delivery', label: 'Work Packages' },
  boards: { group: 'Delivery', label: 'Execution Board' },
  backlog: { group: 'Delivery', label: 'Backlog' },
  gantt: { group: 'Delivery', label: 'Gantt Timeline' },
  roadmap: { group: 'Delivery', label: 'Roadmap & Milestones' },
  calendar: { group: 'Delivery', label: 'Calendar' },
  reports: { group: 'Delivery', label: 'Reports & Velocity' },
  chat: { group: 'Collaboration', label: 'Engineering Chat' },
  meetings: { group: 'Collaboration', label: 'Meetings' },
  documents: { group: 'Collaboration', label: 'Documents & ADRs' },
  knowledge: { group: 'Collaboration', label: 'Knowledge Base' },
  files: { group: 'Collaboration', label: 'Files & Artifacts' },
  repositories: { group: 'Engineering', label: 'Repositories' },
  'merge-requests': { group: 'Engineering', label: 'Merge Requests' },
  pipelines: { group: 'Engineering', label: 'CI/CD Pipelines' },
  releases: { group: 'Engineering', label: 'Releases' },
  teams: { group: 'Organization', label: 'Teams & Divisions' },
  members: { group: 'Organization', label: 'Account Directory' },
  workload: { group: 'Organization', label: 'Workload' },
  settings: { group: 'Administration', label: 'Workspace Settings' },
  roles: { group: 'Administration', label: 'Roles & Access' },
  integrations: { group: 'Administration', label: 'Integrations' },
  audit: { group: 'Administration', label: 'Audit Log' },
};

export default function App() {
  const [authState, setAuthState] = useState<AuthSessionResponse | null>(null);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [data, setData] = useState<WorkspaceBootstrapData | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [activeNav, setActiveNav] = useState<NavKey>('overview');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedWorkPackageId, setSelectedWorkPackageId] = useState<string | null>(null);
  const [createWpOpen, setCreateWpOpen] = useState(false);
  const [wpPrefill, setWpPrefill] = useState<{ title?: string; description?: string } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isOffline, setIsOffline] = useState<boolean>(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
      ? 'dark'
      : 'light'
  );

  const notify = useCallback((tone: ToastMessage['tone'], title: string, detail?: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev.slice(-3), { id, tone, title, detail }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  function toggleTheme() {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      document.documentElement.classList.toggle('dark', next === 'dark');
      try {
        localStorage.setItem('truvornex-theme', next);
      } catch {
        // ignore storage restrictions
      }
      return next;
    });
  }

  const loadWorkspace = useCallback(async () => {
    setBootError(null);
    try {
      const ws = await api.bootstrap();
      setData(ws);
    } catch (err) {
      setBootError(err instanceof Error ? err.message : 'Failed to load workspace.');
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler((reason) => {
      setData(null);
      setSelectedWorkPackageId(null);
      setSessionNotice(reason || 'Your session expired or was revoked. Please sign in again.');
      api
        .getAuthStatus()
        .then(setAuthState)
        .catch(() =>
          setAuthState({
            authenticated: false,
            user: null,
            slotsUsed: 0,
            maxSlots: 8,
            providers: { firebase: true, supabase: false },
          })
        );
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    function handleOnline() {
      setIsOffline(false);
      notify('success', 'Connection restored');
    }
    function handleOffline() {
      setIsOffline(true);
    }
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [notify]);

  useEffect(() => {
    api
      .getAuthStatus()
      .then((status) => {
        setAuthState(status);
        if (status.authenticated) {
          loadWorkspace();
        }
      })
      .catch((err) => {
        setBootError(err instanceof Error ? err.message : 'Server unreachable.');
      });
  }, [loadWorkspace]);

  useEffect(() => {
    let lastG = 0;
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((v) => !v);
        return;
      }
      if (e.key === 'Escape') {
        setMobileNavOpen(false);
        setHelpOpen(false);
        setPrefsOpen(false);
        setShortcutsOpen(false);
        return;
      }

      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);
      if (isInput || !data) return;

      if (e.key === '?') {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
      } else if (e.key.toLowerCase() === 'c' && Date.now() - lastG < 700) {
        e.preventDefault();
        setActiveNav('chat');
        lastG = 0;
      } else if (e.key.toLowerCase() === 'o' && Date.now() - lastG < 700) {
        e.preventDefault();
        setActiveNav('overview');
        lastG = 0;
      } else if (e.key.toLowerCase() === 'g') {
        lastG = Date.now();
      } else if (e.key.toLowerCase() === 'c' && !e.metaKey && !e.ctrlKey && data.currentUser.role !== 'Read-only Observer') {
        e.preventDefault();
        setWpPrefill(null);
        setCreateWpOpen(true);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [data]);

  function handleAuthenticated(session: AuthSessionResponse) {
    if (!session.authenticated || !session.token) {
      return;
    }
    setAuthToken(session.token);
    setSessionNotice(null);
    setAuthState(session);
    setSelectedProjectId('');
    setSelectedWorkPackageId(null);
    loadWorkspace();
  }

  async function handleLogout() {
    try {
      await api.logout();
    } catch {
      // clear local session regardless
    }
    setAuthToken(null);
    setData(null);
    setSessionNotice(null);
    const status = await api.getAuthStatus();
    setAuthState(status);
  }

  if (!authState) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#121212] text-black dark:text-[#e5e5e5] p-6 font-sans text-xs">
        {bootError ? (
          <span className="text-[#b91c1c] dark:text-[#fca5a5]">{bootError}</span>
        ) : (
          'Loading...'
        )}
      </div>
    );
  }

  if (!authState.authenticated) {
    return (
      <AuthScreen
        slotsUsed={authState.slotsUsed}
        maxSlots={authState.maxSlots}
        providers={authState.providers}
        sessionNotice={sessionNotice}
        theme={theme}
        onToggleTheme={toggleTheme}
        onAuthenticated={handleAuthenticated}
      />
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#FAFAFB] dark:bg-[#090A0D] flex items-center justify-center p-6">
        <div className="bg-white dark:bg-[#111318] border border-[#E5E7EB] dark:border-white/[0.08] rounded-xl px-6 py-5 text-sm text-[#5E6572] dark:text-[#9CA3AF]">
          {bootError ? (
            <div className="space-y-3 text-center">
              <p className="text-[#B42318] dark:text-[#FDA29B]">{bootError}</p>
              <button
                type="button"
                onClick={loadWorkspace}
                className="h-9 px-4 bg-[#111215] dark:bg-white text-white dark:text-[#0B0C0E] text-xs font-medium rounded-lg"
              >
                Retry
              </button>
            </div>
          ) : (
            'Loading authorized workspace state…'
          )}
        </div>
      </div>
    );
  }

  const role = data.currentUser.role;
  const canSeeAdmin =
    role === 'Workspace Owner' ||
    role === 'Workspace Administrator' ||
    role === 'Programme Manager';

  const navGroups: Array<{
    label: string;
    items: Array<{ key: NavKey; label: string; icon: typeof LayoutDashboard }>;
  }> = [
    {
      label: 'Workspace',
      items: [
        { key: 'overview', label: 'Overview', icon: LayoutDashboard },
        { key: 'my-work', label: 'My work', icon: CheckSquare },
        { key: 'activity', label: 'Activity', icon: Activity },
        { key: 'inbox', label: 'Inbox', icon: Inbox },
      ],
    },
    {
      label: 'Delivery',
      items: [
        { key: 'projects', label: 'Projects', icon: FolderKanban },
        { key: 'work-packages', label: 'Work packages', icon: Layers },
        { key: 'boards', label: 'Boards', icon: Kanban },
        { key: 'backlog', label: 'Backlog', icon: ListTodo },
        { key: 'gantt', label: 'Gantt', icon: GanttChartSquare },
        { key: 'roadmap', label: 'Roadmap', icon: Milestone },
        { key: 'calendar', label: 'Calendar', icon: Calendar },
        { key: 'reports', label: 'Reports', icon: BarChart3 },
      ],
    },
    {
      label: 'Collaboration',
      items: [
        { key: 'chat', label: 'Chat', icon: MessageSquare },
        { key: 'meetings', label: 'Meetings', icon: Video },
        { key: 'documents', label: 'Documents', icon: FileText },
        { key: 'knowledge', label: 'Knowledge base', icon: Library },
        { key: 'files', label: 'Files', icon: Paperclip },
      ],
    },
    {
      label: 'Engineering',
      items: [
        { key: 'repositories', label: 'Repositories', icon: GitBranch },
        { key: 'merge-requests', label: 'Merge requests', icon: GitMerge },
        { key: 'pipelines', label: 'CI/CD pipelines', icon: PlayCircle },
        { key: 'releases', label: 'Releases', icon: Tag },
      ],
    },
    {
      label: 'Organization',
      items: [
        { key: 'teams', label: 'Teams & divisions', icon: Users },
        { key: 'members', label: 'Account directory', icon: UserCheck },
        { key: 'workload', label: 'Workload', icon: BookOpen },
      ],
    },
    ...(canSeeAdmin
      ? [
          {
            label: 'Administration',
            items: [
              { key: 'settings' as NavKey, label: 'Workspace settings', icon: Settings },
              { key: 'roles' as NavKey, label: 'Roles & access', icon: ShieldCheck },
              { key: 'integrations' as NavKey, label: 'Integrations', icon: Plug },
              { key: 'audit' as NavKey, label: 'Audit log', icon: FileText },
            ],
          },
        ]
      : []),
  ];

  const unreadCount = data.notifications.filter((n) => !n.read).length;
  const activeWorkPackage: WorkPackage | null = selectedWorkPackageId
    ? data.workPackages.find((w) => w.id === selectedWorkPackageId) || null
    : null;
  const activeProject = data.projects.find((p) => p.id === selectedProjectId);
  const currentTitle = NAV_TITLES[activeNav] || { group: 'Workspace', label: 'Overview' };
  const slotPct = Math.min(100, Math.round((data.slotsUsed / data.maxSlots) * 100));

  function handleNavigate(nav: string, projectId?: string) {
    if (projectId !== undefined) setSelectedProjectId(projectId);
    setActiveNav(nav as NavKey);
    setMobileNavOpen(false);
  }

  return (
    <div className="min-h-screen bg-[#FAFAFB] dark:bg-[#090A0D] text-[#111215] dark:text-[#F3F4F6] flex transition-colors">
      {/* Mobile Navigation Backdrop */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Edge-to-Edge Docked Left Workspace Rail */}
      <aside
        aria-label="Primary navigation"
        className={`${
          mobileNavOpen
            ? 'fixed inset-y-0 left-0 z-50 w-[268px] flex shadow-2xl'
            : 'hidden lg:flex lg:w-[252px] lg:sticky lg:top-0 lg:h-screen shrink-0'
        } flex-col bg-[#F4F5F7] dark:bg-[#0D0F13] border-r border-[#E5E7EB] dark:border-white/[0.08]`}
      >
        {/* Rail Header: Brand + Scope Switcher + Search Trigger */}
        <div className="p-3.5 space-y-2.5 border-b border-[#E5E7EB] dark:border-white/[0.08]">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => handleNavigate('overview', '')}
              className="flex items-center gap-2.5 min-w-0 text-left"
            >
              <img
                src="/assets/aistudio/truvornex-mark_d2343037.svg"
                alt="Truvornex mark"
                className="w-7 h-7 rounded-lg shrink-0 ring-1 ring-black/10 dark:ring-white/15"
              />
              <span className="font-display font-semibold text-sm tracking-tight text-[#111215] dark:text-white truncate">
                Truvornex
              </span>
            </button>
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              aria-label="Close navigation"
              className="lg:hidden w-8 h-8 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center text-[#5E6572] dark:text-[#9CA3AF]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="relative">
            <select
              aria-label="Active project scope"
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full h-8 pl-2.5 pr-7 text-xs font-medium bg-white dark:bg-[#14171E] hover:border-[#C5C9D2] dark:hover:border-white/[0.18] border border-[#E2E5EA] dark:border-white/[0.09] rounded-lg text-[#111215] dark:text-[#E5E7EB] appearance-none cursor-pointer transition-colors"
            >
              <option value="">All Projects ({data.projects.length})</option>
              {data.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.key} · {p.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[#5E6572] dark:text-[#9CA3AF] pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" />
          </div>

          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="w-full h-8 px-2.5 bg-white dark:bg-[#14171E] hover:border-[#C5C9D2] dark:hover:border-white/[0.18] border border-[#E2E5EA] dark:border-white/[0.09] rounded-lg text-xs text-[#5E6572] dark:text-[#9CA3AF] flex items-center justify-between gap-2 transition-colors"
          >
            <span className="flex items-center gap-2 truncate">
              <Search className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">Search workspace…</span>
            </span>
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-[#F3F4F6] dark:bg-white/[0.08] text-[#5E6572] dark:text-[#D1D5DB] rounded shrink-0">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Rail Navigation Groups */}
        <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4">
          {navGroups.map((group) => (
            <div key={group.label}>
              <div className="px-2.5 mb-1 text-[11px] font-medium text-[#6B7280] dark:text-[#6B7280]">
                {group.label}
              </div>
              <nav className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = activeNav === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => handleNavigate(item.key)}
                      className={`w-full h-9 lg:h-8 px-2.5 rounded-lg text-xs font-medium flex items-center justify-between gap-2 transition-all whitespace-nowrap ${
                        active
                          ? 'bg-white dark:bg-white/[0.09] text-[#111215] dark:text-white font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.05)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] border border-[#E2E5EA] dark:border-white/[0.09]'
                          : 'text-[#4B5563] dark:text-[#9CA3AF] hover:bg-black/[0.04] dark:hover:bg-white/[0.04] hover:text-[#111215] dark:hover:text-white border border-transparent'
                      }`}
                    >
                      <span className="flex items-center gap-2.5 truncate">
                        <Icon
                          className={`w-3.5 h-3.5 shrink-0 ${
                            active ? 'text-[#111215] dark:text-white' : 'text-[#6B7280] dark:text-[#6B7280]'
                          }`}
                          aria-hidden="true"
                        />
                        <span className="truncate">{item.label}</span>
                      </span>
                      {item.key === 'inbox' && unreadCount > 0 && (
                        <span
                          className={`font-mono text-[11px] tabular-nums ${
                            active ? 'text-[#111215] dark:text-white' : 'text-[#111215] dark:text-[#D1D5DB] font-semibold'
                          }`}
                        >
                          {unreadCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>

        {/* Rail Footer: 8-Slot Meter + Account Identity */}
        <div className="p-3 border-t border-[#E5E7EB] dark:border-white/[0.08] space-y-2.5">
          <button
            type="button"
            onClick={() => handleNavigate('members')}
            className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors space-y-1.5"
          >
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[#5E6572] dark:text-[#9CA3AF]">Account Directory</span>
              <span className="font-mono font-semibold text-[#111215] dark:text-white tabular-nums">
                {data.slotsUsed}/{data.maxSlots}
              </span>
            </div>
            <div className="w-full h-1.5 bg-[#E2E5EA] dark:bg-white/[0.08] rounded-full overflow-hidden">
              <div
                style={{ width: `${slotPct}%` }}
                className={`h-full rounded-full ${
                  data.slotsUsed >= data.maxSlots ? 'bg-[#B42318] dark:bg-[#F97066]' : 'bg-[#111215] dark:bg-white'
                }`}
              />
            </div>
          </button>

          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={() => setPrefsOpen(true)}
              title="Presence & chat notification settings"
              className="flex items-center gap-2.5 min-w-0 flex-1 p-1.5 rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.05] text-left transition-colors"
            >
              <div className="relative shrink-0">
                <UserAvatar name={data.currentUser.displayName} />
                <span
                  className={`w-2.5 h-2.5 rounded-full border-2 border-[#F4F5F7] dark:border-[#0D0F13] absolute -bottom-0.5 -right-0.5 ${
                    data.currentUser.presence === 'focus'
                      ? 'bg-[#60A5FA]'
                      : data.currentUser.presence === 'reviewing'
                      ? 'bg-[#FBBF24]'
                      : data.currentUser.presence === 'away'
                      ? 'bg-[#9CA3AF]'
                      : 'bg-[#34D399]'
                  }`}
                />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium text-[#111215] dark:text-white truncate">
                  {data.currentUser.displayName}
                </div>
                <div className="text-[10px] text-[#5E6572] dark:text-[#9CA3AF] truncate">
                  {data.currentUser.role}
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Sign out"
              title="Sign out"
              className="w-8 h-8 rounded-lg hover:bg-black/[0.06] dark:hover:bg-white/[0.08] flex items-center justify-center text-[#5E6572] dark:text-[#9CA3AF] hover:text-[#111215] dark:hover:text-white shrink-0 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Sleek Sticky Contextual Command Header */}
        <header className="h-[52px] sticky top-0 z-30 bg-white/85 dark:bg-[#090A0D]/85 backdrop-blur-md border-b border-[#E5E7EB] dark:border-white/[0.08] px-3 sm:px-5 lg:px-7 flex items-center justify-between gap-4 shrink-0">
          {/* Zone 1 & 2: Mobile Menu + Breadcrumb Trail */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen((v) => !v)}
              aria-label="Toggle navigation"
              aria-expanded={mobileNavOpen}
              className="lg:hidden w-8 h-8 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center shrink-0"
            >
              <Menu className="w-4 h-4" />
            </button>

            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs min-w-0">
              <span className="hidden sm:inline text-[#6B7280] dark:text-[#6B7280] whitespace-nowrap">
                {currentTitle.group}
              </span>
              <span className="hidden sm:inline text-[#D1D5DB] dark:text-white/20" aria-hidden="true">
                /
              </span>
              <span className="font-medium text-[#111215] dark:text-white truncate">
                {currentTitle.label}
              </span>
              {activeProject && (
                <>
                  <span className="text-[#D1D5DB] dark:text-white/20" aria-hidden="true">
                    /
                  </span>
                  <span className="font-mono font-semibold text-[#111215] dark:text-white shrink-0">
                    {activeProject.key}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedProjectId('')}
                    className="text-[11px] text-[#5E6572] dark:text-[#9CA3AF] hover:text-[#111215] dark:hover:text-white underline whitespace-nowrap shrink-0"
                  >
                    Clear
                  </button>
                </>
              )}
            </nav>
          </div>

          {/* Zone 3: Compact Utilities + Primary Action */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search workspace"
              className="lg:hidden w-8 h-8 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center text-[#5E6572] dark:text-[#9CA3AF]"
            >
              <Search className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              className="w-8 h-8 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center text-[#5E6572] dark:text-[#9CA3AF] hover:text-[#111215] dark:hover:text-white transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => setShortcutsOpen(true)}
              aria-label="Keyboard shortcuts"
              title="Keyboard shortcuts (?)"
              className="hidden sm:flex w-8 h-8 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 items-center justify-center text-[#5E6572] dark:text-[#9CA3AF] hover:text-[#111215] dark:hover:text-white transition-colors"
            >
              <Keyboard className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              aria-label="Workspace guide"
              className="hidden sm:flex w-8 h-8 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 items-center justify-center text-[#5E6572] dark:text-[#9CA3AF] hover:text-[#111215] dark:hover:text-white transition-colors"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => handleNavigate('inbox')}
              aria-label={`Notifications (${unreadCount} unread)`}
              className="h-8 px-2.5 rounded-lg border border-[#E5E7EB] dark:border-white/[0.1] hover:bg-[#F3F4F6] dark:hover:bg-white/[0.06] flex items-center gap-1.5 text-xs text-[#111215] dark:text-[#E5E7EB] transition-colors"
            >
              <Bell className="w-3.5 h-3.5" />
              <span className="font-mono tabular-nums font-semibold">{unreadCount}</span>
            </button>

            {data.currentUser.role !== 'Read-only Observer' && (
              <button
                type="button"
                onClick={() => {
                  setWpPrefill(null);
                  setCreateWpOpen(true);
                }}
                className="h-8 px-3 rounded-lg bg-[#111215] hover:bg-[#262930] dark:bg-white dark:hover:bg-[#E5E7EB] text-white dark:text-[#0B0C0E] text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">New Work Package</span>
                <span className="sm:hidden">New</span>
              </button>
            )}
          </div>
        </header>

        {isOffline && (
          <div
            role="status"
            className="bg-[#FEF0EE] dark:bg-[#2E1314] border-b border-[#F5C6C2] dark:border-[#5E2325] px-4 py-2 text-xs text-[#B42318] dark:text-[#FDA29B] flex items-center justify-center gap-2"
          >
            <WifiOff className="w-3.5 h-3.5 shrink-0" />
            <span>You appear offline — changes will resume once connectivity is restored.</span>
          </div>
        )}

        {/* Main Workspace Canvas */}
        <main className="flex-1 min-w-0 px-3 sm:px-5 lg:px-7 py-5 sm:py-6 pb-20 lg:pb-8 overflow-x-hidden">
          {activeNav === 'overview' && (
            <OverviewDashboard
              data={data}
              selectedProjectId={selectedProjectId}
              onSelectWorkPackage={(wp) => setSelectedWorkPackageId(wp.id)}
              onNavigate={handleNavigate}
              onCreateWorkPackage={() => {
                setWpPrefill(null);
                setCreateWpOpen(true);
              }}
            />
          )}

          {(activeNav === 'my-work' ||
            activeNav === 'projects' ||
            activeNav === 'work-packages' ||
            activeNav === 'boards' ||
            activeNav === 'backlog' ||
            activeNav === 'gantt' ||
            activeNav === 'roadmap' ||
            activeNav === 'calendar') && (
            <WorkViews
              section={activeNav}
              data={data}
              selectedProjectId={selectedProjectId}
              onSelectProject={(pid) => setSelectedProjectId(pid)}
              onSelectWorkPackage={(wp) => setSelectedWorkPackageId(wp.id)}
              onCreateWorkPackage={() => {
                setWpPrefill(null);
                setCreateWpOpen(true);
              }}
              onRefresh={loadWorkspace}
              onNavigate={handleNavigate}
              onNotify={notify}
            />
          )}

          {(activeNav === 'documents' ||
            activeNav === 'knowledge' ||
            activeNav === 'files' ||
            activeNav === 'chat' ||
            activeNav === 'meetings') && (
            <KnowledgeAndCollab
              section={activeNav}
              data={data}
              onRefresh={loadWorkspace}
              onSelectWorkPackage={(wp) => setSelectedWorkPackageId(wp.id)}
              onPromoteToWorkPackage={(title, description) => {
                setWpPrefill({ title, description });
                setCreateWpOpen(true);
              }}
              onNotify={notify}
            />
          )}

          {(activeNav === 'repositories' ||
            activeNav === 'merge-requests' ||
            activeNav === 'pipelines' ||
            activeNav === 'releases') && (
            <EngineeringViews
              section={activeNav}
              data={data}
              onSelectWorkPackage={(wp) => setSelectedWorkPackageId(wp.id)}
            />
          )}

          {(activeNav === 'activity' ||
            activeNav === 'inbox' ||
            activeNav === 'reports' ||
            activeNav === 'teams' ||
            activeNav === 'members' ||
            activeNav === 'workload' ||
            activeNav === 'settings' ||
            activeNav === 'roles' ||
            activeNav === 'integrations' ||
            activeNav === 'audit') && (
            <OrganizationAndAdmin
              section={activeNav}
              data={data}
              onRefresh={loadWorkspace}
              onSelectWorkPackage={(wp) => setSelectedWorkPackageId(wp.id)}
              onSessionReplaced={handleAuthenticated}
              onNotify={notify}
              onOpenPreferences={() => setPrefsOpen(true)}
            />
          )}
        </main>
      </div>

      {/* Mobile Bottom Quick-Nav Bar */}
      <nav
        aria-label="Mobile quick navigation"
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-[#0D0F13]/95 backdrop-blur-md border-t border-[#E5E7EB] dark:border-white/[0.08] px-2 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] grid grid-cols-5 gap-1"
      >
        {(
          [
            { key: 'overview', label: 'Overview', icon: LayoutDashboard },
            { key: 'my-work', label: 'My Work', icon: CheckSquare },
            { key: 'chat', label: 'Chat', icon: MessageSquare },
            { key: 'inbox', label: 'Inbox', icon: Inbox, badge: unreadCount },
          ] as Array<{ key: NavKey; label: string; icon: typeof LayoutDashboard; badge?: number }>
        ).map((item) => {
          const Icon = item.icon;
          const active = activeNav === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => handleNavigate(item.key)}
              className={`relative flex flex-col items-center justify-center py-1 rounded-xl text-[10px] font-medium transition-colors ${
                active
                  ? 'text-[#111215] dark:text-white bg-[#F3F4F6] dark:bg-white/[0.08] font-semibold'
                  : 'text-[#5E6572] dark:text-[#9CA3AF]'
              }`}
            >
              <Icon className="w-4 h-4 mb-0.5" />
              <span>{item.label}</span>
              {Boolean(item.badge && item.badge > 0) && (
                <span className="absolute top-0.5 right-3 min-w-[16px] h-4 px-1 rounded-full bg-[#111215] dark:bg-white text-white dark:text-[#0B0C0E] text-[9px] font-mono flex items-center justify-center">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setMobileNavOpen((v) => !v)}
          className="flex flex-col items-center justify-center py-1 rounded-xl text-[10px] font-medium text-[#5E6572] dark:text-[#9CA3AF]"
        >
          <Menu className="w-4 h-4 mb-0.5" />
          <span>More</span>
        </button>
      </nav>

      {/* Work Package Slide-Over Detail Panel */}
      <WorkPackageDrawer
        workPackage={activeWorkPackage}
        data={data}
        onClose={() => setSelectedWorkPackageId(null)}
        onRefresh={loadWorkspace}
        onDuplicate={(title, description) => {
          setSelectedWorkPackageId(null);
          setWpPrefill({ title, description });
          setCreateWpOpen(true);
        }}
        onNotify={notify}
      />

      {/* Create Work Package Modal */}
      <CreateWorkPackageModal
        open={createWpOpen}
        data={data}
        defaultProjectId={selectedProjectId}
        prefill={wpPrefill}
        onClose={() => {
          setCreateWpOpen(false);
          setWpPrefill(null);
        }}
        onCreated={async (wp) => {
          await loadWorkspace();
          setSelectedWorkPackageId(wp.id);
          notify('success', `Created ${wp.key}`, wp.title);
        }}
      />

      <UserPreferencesModal
        open={prefsOpen}
        user={data.currentUser}
        onClose={() => setPrefsOpen(false)}
        onSaved={loadWorkspace}
        onNotify={notify}
      />

      <KeyboardShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      <ToastStack
        toasts={toasts}
        onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      />

      {/* Global Search Command Palette */}
      <CommandPalette
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelectWorkPackage={(wp) => setSelectedWorkPackageId(wp.id)}
        onNavigate={handleNavigate}
      />

      {/* Help & Trust Boundary Dialog */}
      {helpOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/75 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Workspace reference and trust boundaries"
        >
          <div className="w-full max-w-[520px] bg-white dark:bg-[#111318] border border-[#E5E7EB] dark:border-white/[0.1] rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-[#111215] dark:text-white">
                Truvornex Engineering Workspace Guide
              </h2>
              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                aria-label="Close help"
                className="w-8 h-8 rounded-lg border border-[#E5E7EB] dark:border-white/[0.1] hover:bg-[#F3F4F6] dark:hover:bg-white/[0.08] text-[#111215] dark:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs text-[#111215] dark:text-[#E5E7EB] space-y-2.5 leading-relaxed">
              <p>
                <strong>Canonical Work Records:</strong> Overview, Kanban Board, Backlog, Gantt,
                Roadmap, Calendar, and Reports operate on the same underlying work packages.
              </p>
              <p>
                <strong>Workflow Gates:</strong> Moving a task to <em>Ready</em> enforces title,
                problem statement, owner, acceptance criteria, and dependency confirmation. Moving to{' '}
                <em>In Review</em> or <em>Accepted</em> requires verification evidence and enforces
                separation of duties on high-risk items.
              </p>
              <p>
                <strong>Account Governance (ADR-003):</strong> Strictly limited to 8 accounts
                provisioned by the Workspace Owner in Firebase Auth or Supabase, and isolated from
                production operator infrastructure.
              </p>
              <p className="text-[#5E6572] dark:text-[#9CA3AF] font-mono">
                Press ⌘K / Ctrl+K to search or ? for keyboard shortcuts.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
