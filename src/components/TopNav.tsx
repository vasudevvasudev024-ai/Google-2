import {
  Activity,
  Bot,
  FileJson,
  GitBranch,
  Plus,
  Shield,
  Wallet,
} from 'lucide-react';

export type StudioTab =
  | 'overview'
  | 'agents'
  | 'workflows'
  | 'security'
  | 'budget'
  | 'contracts';

interface NavItem {
  id: StudioTab;
  label: string;
  shortLabel: string;
  Icon: typeof Activity;
}

export const NEXUS_NAV_ITEMS: readonly NavItem[] = [
  { id: 'overview', label: 'Overview', shortLabel: 'Overview', Icon: Activity },
  { id: 'agents', label: 'Agent Divisions', shortLabel: 'Divisions', Icon: Bot },
  { id: 'workflows', label: 'Workflows', shortLabel: 'Workflows', Icon: GitBranch },
  { id: 'security', label: 'Security & Policy', shortLabel: 'Security', Icon: Shield },
  { id: 'budget', label: 'Budget & Spend', shortLabel: 'Budget', Icon: Wallet },
  { id: 'contracts', label: 'Contract JSON', shortLabel: 'JSON', Icon: FileJson },
];

interface TopNavProps {
  activeTab: StudioTab;
  activeWorkflowId: string;
  pendingApprovalCount: number;
  onSelectTab: (tab: StudioTab) => void;
  onOpenNewWorkflow: () => void;
}

export function NexusSidebar({
  activeTab,
  pendingApprovalCount,
  onSelectTab,
}: Pick<TopNavProps, 'activeTab' | 'pendingApprovalCount' | 'onSelectTab'>) {
  return (
    <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-60 lg:flex-col lg:shrink-0 border-r border-slate-200 bg-white">
      <div className="flex h-14 items-center border-b border-slate-200 px-5">
        <button
          type="button"
          onClick={() => onSelectTab('overview')}
          className="font-display text-base font-bold tracking-tight text-slate-900 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
        >
          NEXUS APEX
        </button>
      </div>

      <nav aria-label="Primary navigation" className="flex-1 space-y-1 px-3 py-4">
        {NEXUS_NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.Icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                isActive
                  ? 'bg-blue-50 text-blue-800'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <Icon
                  className={`h-4 w-4 shrink-0 ${isActive ? 'text-blue-700' : 'text-slate-400'}`}
                  aria-hidden="true"
                />
                <span className="truncate">{item.label}</span>
              </span>
              {item.id === 'workflows' && pendingApprovalCount > 0 && (
                <span className="font-mono text-xs font-semibold text-amber-700 tabular-nums">
                  {pendingApprovalCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 px-5 py-4 space-y-1 text-xs text-slate-500">
        <p className="font-medium text-slate-700">Stage 1 Control Plane</p>
        <p className="font-mono text-[11px]">NACS v1.0 · Zero Paid Calls</p>
      </div>
    </aside>
  );
}

export function TopNav({
  activeTab,
  activeWorkflowId,
  onSelectTab,
  onOpenNewWorkflow,
}: TopNavProps) {
  const currentSection = NEXUS_NAV_ITEMS.find((item) => item.id === activeTab);

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="flex h-14 items-center justify-between gap-8 px-4 sm:px-6">
        <div className="flex items-center gap-2 text-sm min-w-0">
          <button
            type="button"
            onClick={() => onSelectTab('overview')}
            className="lg:hidden font-display text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            NEXUS APEX
          </button>
          <span className="lg:hidden text-slate-300" aria-hidden="true">
            /
          </span>
          <span className="hidden lg:inline text-slate-500 whitespace-nowrap">NEXUS APEX</span>
          <span className="hidden lg:inline text-slate-300" aria-hidden="true">
            /
          </span>
          <span className="font-medium text-slate-900 truncate">
            {currentSection?.label ?? 'Overview'}
          </span>
          <span className="hidden sm:inline text-slate-300" aria-hidden="true">
            /
          </span>
          <span className="hidden sm:inline font-mono text-xs text-slate-500 whitespace-nowrap">
            {activeWorkflowId}
          </span>
        </div>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onOpenNewWorkflow}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-800 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>New Workflow</span>
          </button>
        </div>
      </div>

      {/* Compact Mobile Navigation Row */}
      <nav
        aria-label="Mobile navigation"
        className="flex lg:hidden items-center justify-between gap-2 overflow-x-auto border-t border-slate-100 px-4 py-2"
      >
        {NEXUS_NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`py-1 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                isActive
                  ? 'text-blue-700 underline underline-offset-4'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {item.shortLabel}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
