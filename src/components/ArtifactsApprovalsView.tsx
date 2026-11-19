import { useState } from 'react';
import { Check, Film, FileCode2, FileText, ShieldCheck, X } from 'lucide-react';
import type { ArtifactReviewStatus, WorkflowBundle } from '../core/contracts';
import { ApprovalStateLabel, ArtifactReviewLabel } from './StateBadge';

interface ArtifactsApprovalsViewProps {
  bundle: WorkflowBundle;
  onDecideApproval: (approvalId: string, decision: 'approved' | 'rejected', note?: string) => void;
  onUpdateArtifactReview: (artifactId: string, status: ArtifactReviewStatus) => void;
}

export function ArtifactsApprovalsView({
  bundle,
  onDecideApproval,
  onUpdateArtifactReview,
}: ArtifactsApprovalsViewProps) {
  const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>({});
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  return (
    <div className="space-y-8">
      {/* Human Approval Contracts Section */}
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-blue-700" aria-hidden="true" />
            <h1 className="font-display text-lg font-bold text-slate-900">
              Approval Contracts ({bundle.approvals.length})
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-600">
            Actions governed by autonomy policy and spend limits requiring explicit human authorization.
          </p>
        </div>

        {bundle.approvals.length === 0 ? (
          <div className="px-6 py-8 text-sm text-slate-500">
            No approval gates have been triggered on this workflow yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {bundle.approvals.map((appr) => {
              const isPending = appr.status === 'pending';
              return (
                <div key={appr.approval_id} className="p-6 space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <ApprovalStateLabel status={appr.status} />
                        <span className="font-mono text-slate-800">{appr.approval_id}</span>
                        <span aria-hidden="true">·</span>
                        <span>Task: {appr.task_id}</span>
                        <span aria-hidden="true">·</span>
                        <span>Trigger: {appr.trigger_reason}</span>
                      </div>
                      <p className="text-sm font-semibold text-slate-900">{appr.requested_action}</p>
                    </div>

                    <div className="text-left sm:text-right shrink-0">
                      <p className="font-mono text-sm font-semibold text-slate-900 tabular-nums">
                        {appr.currency} {appr.estimated_cost}
                      </p>
                      <p className="font-mono text-xs text-slate-500 tabular-nums">
                        {appr.requested_at.replace('T', ' ').slice(0, 19)}
                      </p>
                    </div>
                  </div>

                  {isPending ? (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <label htmlFor={`note-${appr.approval_id}`} className="sr-only">
                        Decision note for {appr.approval_id}
                      </label>
                      <input
                        id={`note-${appr.approval_id}`}
                        type="text"
                        value={decisionNotes[appr.approval_id] ?? ''}
                        onChange={(e) =>
                          setDecisionNotes((prev) => ({ ...prev, [appr.approval_id]: e.target.value }))
                        }
                        placeholder="Optional authorization note..."
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none sm:max-w-md"
                      />
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            onDecideApproval(appr.approval_id, 'approved', decisionNotes[appr.approval_id])
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-emerald-800 whitespace-nowrap"
                        >
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Approve</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onDecideApproval(appr.approval_id, 'rejected', decisionNotes[appr.approval_id])
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3.5 py-2 text-xs font-medium text-red-700 hover:bg-red-50 whitespace-nowrap"
                        >
                          <X className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Reject</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-600">
                      Decided by <span className="font-medium text-slate-900">{appr.decided_by}</span>
                      {appr.decided_at ? ` · ${appr.decided_at.replace('T', ' ').slice(0, 19)}` : ''}
                      {appr.decision_note ? ` · "${appr.decision_note}"` : ''}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Common Artifact Registry */}
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="font-display text-lg font-bold text-slate-900">
            Artifact Contracts & Provenance ({bundle.artifacts.length})
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            Produced files, generated media, provenance hashes, and human review status.
          </p>
        </div>

        {bundle.artifacts.length === 0 ? (
          <div className="px-6 py-8 text-sm text-slate-500">
            No artifacts produced yet. Complete tasks in Tasks & Results to register outputs.
          </div>
        ) : (
          <div className="grid grid-cols-1 divide-y divide-slate-200">
            {bundle.artifacts.map((art) => {
              const showImage = Boolean(art.image_url && !brokenImages[art.artifact_id]);
              return (
                <article key={art.artifact_id} className="p-6">
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <ArtifactReviewLabel status={art.review_status} />
                        <span className="font-mono text-slate-800">{art.artifact_id}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">{art.kind}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">{art.mime_type}</span>
                      </div>

                      <h3 className="font-display text-base font-semibold text-slate-900">
                        {art.title}
                      </h3>

                      <p className="font-mono text-xs text-slate-500 truncate">{art.uri}</p>

                      {art.preview_text && (
                        <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs leading-relaxed text-slate-800">
                          {art.preview_text}
                        </pre>
                      )}

                      <dl className="grid grid-cols-1 gap-2 pt-1 text-xs text-slate-600 sm:grid-cols-3">
                        <div>
                          <dt className="text-slate-400">Agent</dt>
                          <dd className="font-mono text-slate-800">{art.provenance.agent_id}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-400">Generator / Tool</dt>
                          <dd className="font-mono text-slate-800">{art.provenance.model_or_tool}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-400">Input Hash</dt>
                          <dd className="font-mono text-slate-800">{art.provenance.input_hash}</dd>
                        </div>
                      </dl>
                    </div>

                    <div className="flex flex-col gap-3 lg:w-72 shrink-0">
                      {art.image_url && (
                        <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-100 aspect-video">
                          {showImage ? (
                            <img
                              src={art.image_url}
                              alt={art.title}
                              referrerPolicy="no-referrer"
                              onError={() =>
                                setBrokenImages((prev) => ({ ...prev, [art.artifact_id]: true }))
                              }
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-slate-100 p-4 text-center text-xs text-slate-500">
                              {art.track === 'creative' ? (
                                <Film className="h-5 w-5 text-slate-400" aria-hidden="true" />
                              ) : art.kind === 'code' ? (
                                <FileCode2 className="h-5 w-5 text-slate-400" aria-hidden="true" />
                              ) : (
                                <FileText className="h-5 w-5 text-slate-400" aria-hidden="true" />
                              )}
                              <span>{art.title}</span>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onUpdateArtifactReview(art.artifact_id, 'approved')}
                          className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                            art.review_status === 'approved'
                              ? 'border-emerald-700 bg-emerald-700 text-white'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          Approve Output
                        </button>
                        <button
                          type="button"
                          onClick={() => onUpdateArtifactReview(art.artifact_id, 'changes_requested')}
                          className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                            art.review_status === 'changes_requested'
                              ? 'border-red-700 bg-red-700 text-white'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          Request Revision
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
