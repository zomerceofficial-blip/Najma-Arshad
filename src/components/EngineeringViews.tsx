import { AlertTriangle, CheckCircle2, ExternalLink, GitBranch, GitMerge, PlayCircle, Tag, XCircle } from 'lucide-react';
import { safeHttpUrl, type WorkspaceBootstrapData } from '../lib/api.ts';
import type { WorkPackage } from '../types/workspace.ts';

interface EngineeringViewsProps {
  section: 'repositories' | 'merge-requests' | 'pipelines' | 'releases';
  data: WorkspaceBootstrapData;
  onSelectWorkPackage: (wp: WorkPackage) => void;
}

export function EngineeringViews({
  section,
  data,
  onSelectWorkPackage,
}: EngineeringViewsProps) {
  const gitlab = data.integrations.find((i) => i.provider === 'gitlab');
  const kindMap: Record<EngineeringViewsProps['section'], string> = {
    repositories: 'repository',
    'merge-requests': 'merge_request',
    pipelines: 'pipeline',
    releases: 'release',
  };
  const titleMap: Record<EngineeringViewsProps['section'], string> = {
    repositories: 'Connected Repositories (GitLab)',
    'merge-requests': 'Merge Requests & Reviews',
    pipelines: 'CI/CD Pipelines',
    releases: 'Tagged Releases',
  };

  const items = data.externalLinks.filter(
    (l) => l.provider === 'gitlab' && l.kind === kindMap[section]
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold text-[#111215] dark:text-[#F3F4F6] tracking-tight">{titleMap[section]}</h1>
        <p className="text-sm text-[#5E6572] dark:text-[#9CA3AF] mt-0.5">
          Normalized provider metadata traced to canonical Truvornex work packages (source blobs stay in GitLab)
        </p>
      </div>

      {gitlab && !gitlab.enabled && (
        <div className="p-4 rounded-xl border border-[#F0D9A6] dark:border-amber-500/25 bg-[#FEF7E6] dark:bg-amber-500/10 text-[#9B6B08] dark:text-amber-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            GitLab integration is currently disabled. Displaying last synchronized metadata; local workspace operations continue uninterrupted.
          </span>
        </div>
      )}

      <div className="bg-white dark:bg-[#111318] border border-[#E2E5EA] dark:border-white/[0.08] rounded-xl overflow-hidden divide-y divide-[#EFF1F4] dark:divide-white/[0.06]">
        {items.map((item) => {
          const linkedWp = item.workPackageId
            ? data.workPackages.find((w) => w.id === item.workPackageId)
            : undefined;
          const proj = data.projects.find((p) => p.id === item.projectId);
          const isFailed = item.status.toLowerCase().includes('fail');
          const isPassed =
            item.status.toLowerCase().includes('pass') ||
            item.status.toLowerCase().includes('verified');

          const safeUrl = safeHttpUrl(item.url);

          return (
            <div key={item.id} className="px-4 sm:px-5 py-4 flex flex-wrap items-center justify-between gap-3 sm:gap-4">
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#111215] dark:text-[#F3F4F6]">
                  {section === 'repositories' && <GitBranch className="w-4 h-4 text-[#111215] dark:text-[#D8D8D8] shrink-0" />}
                  {section === 'merge-requests' && <GitMerge className="w-4 h-4 text-[#111215] dark:text-[#D8D8D8] shrink-0" />}
                  {section === 'pipelines' && <PlayCircle className="w-4 h-4 text-[#111215] dark:text-[#D8D8D8] shrink-0" />}
                  {section === 'releases' && <Tag className="w-4 h-4 text-[#111215] dark:text-[#D8D8D8] shrink-0" />}
                  <span className="truncate">{item.title}</span>
                </div>
                <div className="text-xs text-[#5E6572] dark:text-[#9CA3AF] flex flex-wrap items-center gap-2">
                  <span className="font-mono">{proj?.key}</span>
                  <span aria-hidden="true">·</span>
                  {safeUrl ? (
                    <a
                      href={safeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[#111215] dark:text-[#F3F4F6] hover:underline inline-flex items-center gap-1"
                    >
                      <span>{item.externalId}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <span className="font-mono">{item.externalId}</span>
                  )}
                  {item.authorName && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{item.authorName}</span>
                    </>
                  )}
                  {item.metadata &&
                    Object.entries(item.metadata).map(([k, v]) => (
                      <span key={k} className="font-mono text-[11px]">
                        · {k}: {v}
                      </span>
                    ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border text-[11px] font-medium ${
                    isFailed
                      ? 'bg-[#FEF0EE] dark:bg-red-500/10 border-[#F5C6C2] dark:border-red-500/25 text-[#B42318] dark:text-red-300'
                      : isPassed
                      ? 'bg-[#ECF7F1] dark:bg-emerald-500/10 border-[#BCE3CE] dark:border-emerald-500/25 text-[#1F764D] dark:text-emerald-300'
                      : 'bg-[#F3F4F6] dark:bg-white/[0.05] border-[#E2E5EA] dark:border-white/[0.1] text-[#111215] dark:text-[#E5E7EB]'
                  }`}
                >
                  {isFailed ? (
                    <XCircle className="w-3.5 h-3.5" />
                  ) : isPassed ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : null}
                  <span>{item.status}</span>
                </span>
                {linkedWp && (
                  <button
                    type="button"
                    onClick={() => onSelectWorkPackage(linkedWp)}
                    className="h-9 sm:h-8 px-3 border border-[#D8DCE3] dark:border-white/[0.12] bg-white dark:bg-[#161922] hover:bg-[#ECEEF2] dark:hover:bg-white/[0.08] text-xs font-mono font-semibold text-[#111215] dark:text-white rounded-lg"
                  >
                    {linkedWp.key}
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {items.length === 0 && (
          <div className="p-8 text-center text-xs text-[#5E6572] dark:text-[#9CA3AF]">
            No synchronized {section.replace('-', ' ')} metadata available for your authorized projects.
          </div>
        )}
      </div>
    </div>
  );
}
