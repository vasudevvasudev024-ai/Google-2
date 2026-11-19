import { Plus } from 'lucide-react';

export type StudioTab = 'overview' | 'state-machine' | 'tasks' | 'artifacts' | 'json';

interface TopNavProps {
  activeTab: StudioTab;
  onSelectTab: (tab: StudioTab) => void;
  onOpenNewWorkflow: () => void;
}

const NAV_ITEMS: Array<{ id: StudioTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'state-machine', label: 'State Machine' },
  { id: 'tasks', label: 'Tasks & Results' },
  { id: 'artifacts', label: 'Artifacts & Approvals' },
  { id: 'json', label: 'Contract JSON' },
];

export function TopNav({ activeTab, onSelectTab, onOpenNewWorkflow }: TopNavProps) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={() => onSelectTab('overview')}
          className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
        >
          Relay Contract Studio
        </button>

        <nav aria-label="Primary sections" className="hidden md:flex items-center gap-6">
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative py-1.5 text-sm font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 ${
                  isActive
                    ? 'text-blue-700 after:absolute after:inset-x-0 after:-bottom-[13px] after:h-0.5 after:bg-blue-700'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onOpenNewWorkflow}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-800 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>New Workflow</span>
          </button>
        </div>
      </div>

      <nav
        aria-label="Mobile sections"
        className="flex md:hidden items-center gap-3.5 overflow-x-auto border-t border-slate-100 px-4 py-2 pr-6"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`py-1 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                isActive ? 'text-blue-700 underline underline-offset-4' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
