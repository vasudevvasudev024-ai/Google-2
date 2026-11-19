import { ArrowRight, RotateCcw } from 'lucide-react';
import type { WorkflowBundle, WorkflowState } from '../core/contracts';
import { getAvailableTransitions, STATE_METADATA, WORKFLOW_TRANSITIONS } from '../core/stateMachine';
import { WorkflowStateLabel } from './StateBadge';

interface StateMachineViewProps {
  bundle: WorkflowBundle;
  onTransition: (to: WorkflowState) => void;
  onResetToDraft: () => void;
}

interface NodePos {
  id: WorkflowState;
  label: string;
  x: number;
  y: number;
}

const DIAGRAM_NODES: NodePos[] = [
  { id: 'draft', label: 'draft', x: 110, y: 80 },
  { id: 'queued', label: 'queued', x: 270, y: 80 },
  { id: 'planning', label: 'planning', x: 440, y: 80 },
  { id: 'running', label: 'running', x: 630, y: 80 },
  { id: 'waiting_approval', label: 'waiting_approval', x: 535, y: 215 },
  { id: 'reviewing', label: 'reviewing', x: 810, y: 80 },
  { id: 'completed', label: 'completed', x: 980, y: 80 },
  { id: 'failed', label: 'failed', x: 440, y: 340 },
  { id: 'cancelled', label: 'cancelled', x: 760, y: 340 },
];

interface EdgeDef {
  from: WorkflowState;
  to: WorkflowState;
  label?: string;
  path: string;
  labelX?: number;
  labelY?: number;
}

const DIAGRAM_EDGES: EdgeDef[] = [
  { from: 'draft', to: 'queued', path: 'M 168 80 L 212 80' },
  { from: 'queued', to: 'planning', path: 'M 328 80 L 382 80' },
  { from: 'planning', to: 'running', path: 'M 498 80 L 572 80' },
  { from: 'planning', to: 'waiting_approval', path: 'M 465 102 L 510 190' },
  { from: 'running', to: 'waiting_approval', path: 'M 600 102 L 552 190' },
  { from: 'waiting_approval', to: 'running', path: 'M 588 194 Q 638 162 642 104' },
  { from: 'running', to: 'reviewing', path: 'M 688 80 L 752 80' },
  {
    from: 'reviewing',
    to: 'running',
    label: 'Corrections needed',
    path: 'M 790 58 Q 720 18 655 58',
    labelX: 722,
    labelY: 22,
  },
  {
    from: 'reviewing',
    to: 'completed',
    label: 'Passed',
    path: 'M 868 80 L 922 80',
    labelX: 895,
    labelY: 66,
  },
  { from: 'planning', to: 'failed', path: 'M 440 102 L 440 315' },
  { from: 'running', to: 'failed', path: 'M 610 102 L 465 315' },
  { from: 'reviewing', to: 'failed', path: 'M 795 102 L 478 318' },
  {
    from: 'failed',
    to: 'queued',
    label: 'Authorized retry',
    path: 'M 382 340 Q 270 340 270 104',
    labelX: 280,
    labelY: 318,
  },
  { from: 'draft', to: 'cancelled', path: 'M 110 102 Q 110 398 702 350' },
  { from: 'queued', to: 'cancelled', path: 'M 270 102 Q 300 385 702 346' },
  { from: 'planning', to: 'cancelled', path: 'M 462 102 L 720 318' },
  { from: 'running', to: 'cancelled', path: 'M 650 102 L 748 315' },
  { from: 'waiting_approval', to: 'cancelled', path: 'M 575 235 L 725 322' },
  { from: 'reviewing', to: 'cancelled', path: 'M 825 102 L 775 315' },
];

export function StateMachineView({ bundle, onTransition, onResetToDraft }: StateMachineViewProps) {
  const availableTransitions = getAvailableTransitions(bundle);
  const availableTargets = new Set(availableTransitions.map((t) => t.to));
  const pendingApprovalCount = bundle.approvals.filter((a) => a.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Control Header */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-xl font-bold text-slate-900">
                Workflow Lifecycle State Machine
              </h1>
              <WorkflowStateLabel state={bundle.state} />
            </div>
            <p className="text-xs text-slate-600">
              Click any highlighted valid transition button or target state node below to step through the workflow lifecycle.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {availableTransitions.map((opt) => {
              const isPrimary =
                opt.to === 'completed' ||
                opt.to === 'running' ||
                opt.to === 'reviewing' ||
                opt.to === 'planning' ||
                opt.to === 'queued';
              const isDanger = opt.to === 'failed' || opt.to === 'cancelled';

              return (
                <button
                  key={opt.to}
                  type="button"
                  onClick={() => onTransition(opt.to)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
                    isPrimary
                      ? 'bg-blue-700 text-white hover:bg-blue-800'
                      : isDanger
                        ? 'border border-red-200 bg-white text-red-700 hover:bg-red-50'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>{opt.actionLabel}</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              );
            })}

            <button
              type="button"
              onClick={onResetToDraft}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Reset to Draft</span>
            </button>
          </div>
        </div>

        {bundle.state === 'waiting_approval' && pendingApprovalCount > 0 && (
          <p className="mt-3 text-xs font-medium text-amber-800">
            Transition to running is locked while {pendingApprovalCount} approval contract(s) remain pending. Approve or reject in Overview or Artifacts & Approvals.
          </p>
        )}

        {/* Interactive SVG State Diagram */}
        <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-4">
          <svg
            viewBox="0 0 1100 410"
            className="min-w-[880px] w-full h-auto"
            role="img"
            aria-label="Interactive workflow state machine diagram"
          >
            <defs>
              <marker
                id="arrow-muted"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#94a3b8" />
              </marker>
              <marker
                id="arrow-active"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#1d4ed8" />
              </marker>
            </defs>

            {/* Start marker [*] */}
            <circle cx="28" cy="80" r="8" fill="#0f172a" />
            <line
              x1="36"
              y1="80"
              x2="48"
              y2="80"
              stroke="#64748b"
              strokeWidth="1.5"
              markerEnd="url(#arrow-muted)"
            />

            {/* Edges */}
            {DIAGRAM_EDGES.map((edge) => {
              const isOutgoingFromCurrent = edge.from === bundle.state && availableTargets.has(edge.to);
              return (
                <g key={`${edge.from}->${edge.to}`}>
                  <path
                    d={edge.path}
                    fill="none"
                    stroke={isOutgoingFromCurrent ? '#1d4ed8' : '#cbd5e1'}
                    strokeWidth={isOutgoingFromCurrent ? 2 : 1.35}
                    markerEnd={isOutgoingFromCurrent ? 'url(#arrow-active)' : 'url(#arrow-muted)'}
                  />
                  {edge.label && edge.labelX && edge.labelY && (
                    <text
                      x={edge.labelX}
                      y={edge.labelY}
                      textAnchor="middle"
                      className="fill-slate-600 text-[11px] font-medium"
                    >
                      {edge.label}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Terminal rings */}
            <circle cx="1076" cy="80" r="10" fill="none" stroke="#0f172a" strokeWidth="1.5" />
            <circle cx="1076" cy="80" r="5" fill="#0f172a" />
            <path d="M 1038 80 L 1063 80" stroke="#64748b" strokeWidth="1.5" markerEnd="url(#arrow-muted)" />

            <circle cx="848" cy="340" r="10" fill="none" stroke="#0f172a" strokeWidth="1.5" />
            <circle cx="848" cy="340" r="5" fill="#0f172a" />
            <path d="M 818 340 L 835 340" stroke="#64748b" strokeWidth="1.5" markerEnd="url(#arrow-muted)" />

            {/* State Nodes */}
            {DIAGRAM_NODES.map((node) => {
              const isCurrent = node.id === bundle.state;
              const isTargetable = availableTargets.has(node.id);
              const boxW = node.id === 'waiting_approval' ? 136 : 116;
              const boxH = 42;
              const rectX = node.x - boxW / 2;
              const rectY = node.y - boxH / 2;

              return (
                <g
                  key={node.id}
                  onClick={() => {
                    if (isTargetable) onTransition(node.id);
                  }}
                  style={{ cursor: isTargetable ? 'pointer' : 'default' }}
                >
                  <rect
                    x={rectX}
                    y={rectY}
                    width={boxW}
                    height={boxH}
                    rx="8"
                    fill={isCurrent ? '#1d4ed8' : isTargetable ? '#eff6ff' : '#ffffff'}
                    stroke={isCurrent ? '#1e40af' : isTargetable ? '#2563eb' : '#cbd5e1'}
                    strokeWidth={isCurrent || isTargetable ? 2 : 1.25}
                  />
                  <text
                    x={node.x}
                    y={node.y + 4}
                    textAnchor="middle"
                    className={`font-mono text-[12px] font-medium ${
                      isCurrent ? 'fill-white' : isTargetable ? 'fill-blue-800' : 'fill-slate-800'
                    }`}
                  >
                    {node.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </section>

      {/* Valid Outgoing Edges & Transition Audit Log */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="font-display text-base font-semibold text-slate-900">
            Transition Rules from <span className="font-mono text-blue-700">{bundle.state}</span>
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            Declared outgoing paths in <span className="font-mono">stateDiagram-v2</span> for the active state.
          </p>

          <div className="mt-4 divide-y divide-slate-200">
            {WORKFLOW_TRANSITIONS[bundle.state].length === 0 ? (
              <p className="py-4 text-sm text-slate-600">
                Terminal state reached. Use Reset to Draft to replay lifecycle transitions.
              </p>
            ) : (
              WORKFLOW_TRANSITIONS[bundle.state].map((edge) => {
                const enabled = availableTargets.has(edge.to);
                return (
                  <div key={edge.to} className="flex items-center justify-between gap-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {bundle.state} <span className="text-slate-400">→</span>{' '}
                        <span className="font-mono text-blue-700">{edge.to}</span>
                      </p>
                      <p className="text-xs text-slate-500">
                        {edge.label}
                        {!enabled && edge.requiresPendingApprovalCleared
                          ? ' (Blocked until pending approval contracts are decided)'
                          : ''}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={!enabled}
                      onClick={() => onTransition(edge.to)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45 whitespace-nowrap"
                    >
                      {edge.actionLabel}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="font-display text-base font-semibold text-slate-900">
            Transition Audit Log ({bundle.transitions.length})
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            Chronological record of state transitions, actors, and policy notes.
          </p>

          <ol className="mt-4 divide-y divide-slate-200 max-h-80 overflow-y-auto">
            {[...bundle.transitions].reverse().map((tr) => (
              <li key={tr.id} className="py-3 space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono font-medium text-slate-900">
                    {tr.from} → {tr.to}
                  </span>
                  <span className="font-mono text-slate-500 tabular-nums">
                    {tr.timestamp.replace('T', ' ').slice(0, 19)}
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  {tr.label} · Actor: {tr.actor}
                </p>
                {tr.note && <p className="text-xs text-slate-500">{tr.note}</p>}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
