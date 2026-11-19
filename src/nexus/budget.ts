import type { WorkflowBundle } from '../core/contracts';
import { calculateWorkflowSpend } from '../core/stateMachine';
import { NEXUS_DIVISIONS, type NexusDivisionId } from './divisions';

export interface DivisionBudgetAllocation {
  division_id: NexusDivisionId;
  division_name: string;
  monthly_cap_usd: number;
  reserved_usd: number;
  incurred_usd: number;
  hard_stop_enabled: boolean;
  require_approval_over_cap: boolean;
}

export interface WorkspaceBudgetPolicy {
  workspace_id: string;
  currency: 'USD';
  monthly_platform_cap_usd: number;
  zero_spend_safety_lock: boolean;
  allow_unknown_cost_providers: boolean;
  alert_threshold_pct: number;
  allocations: DivisionBudgetAllocation[];
}

export interface BudgetSummary {
  monthlyPlatformCapUsd: number;
  totalAllocatedUsd: number;
  unallocatedReserveUsd: number;
  allocationOverPlatformCap: boolean;
  totalIncurredUsd: number;
  totalReservedUsd: number;
  projectedUtilizationPct: number;
  workflowCountOverLimit: number;
}

export function createInitialBudgetPolicy(workspaceId = 'workspace_demo'): WorkspaceBudgetPolicy {
  return {
    workspace_id: workspaceId,
    currency: 'USD',
    monthly_platform_cap_usd: 1500,
    zero_spend_safety_lock: true,
    allow_unknown_cost_providers: false,
    alert_threshold_pct: 80,
    allocations: NEXUS_DIVISIONS.map((div) => ({
      division_id: div.id,
      division_name: div.name,
      monthly_cap_usd: div.defaultMonthlyCapUsd,
      reserved_usd: 0,
      incurred_usd: 0,
      hard_stop_enabled: true,
      require_approval_over_cap: true,
    })),
  };
}

export function updateDivisionCap(
  policy: WorkspaceBudgetPolicy,
  divisionId: NexusDivisionId,
  nextCapUsd: number
): { policy: WorkspaceBudgetPolicy; error?: string } {
  if (!Number.isFinite(nextCapUsd) || nextCapUsd < 0) {
    return { policy, error: 'Division budget cap must be a non-negative finite number.' };
  }
  const rounded = Math.round(nextCapUsd * 100) / 100;
  return {
    policy: {
      ...policy,
      allocations: policy.allocations.map((alloc) =>
        alloc.division_id === divisionId ? { ...alloc, monthly_cap_usd: rounded } : alloc
      ),
    },
  };
}

export function toggleDivisionHardStop(
  policy: WorkspaceBudgetPolicy,
  divisionId: NexusDivisionId
): WorkspaceBudgetPolicy {
  return {
    ...policy,
    allocations: policy.allocations.map((alloc) =>
      alloc.division_id === divisionId
        ? { ...alloc, hard_stop_enabled: !alloc.hard_stop_enabled }
        : alloc
    ),
  };
}

export function updatePlatformCap(
  policy: WorkspaceBudgetPolicy,
  nextCapUsd: number
): { policy: WorkspaceBudgetPolicy; error?: string } {
  if (!Number.isFinite(nextCapUsd) || nextCapUsd <= 0) {
    return { policy, error: 'Monthly platform budget cap must be greater than zero.' };
  }
  const rounded = Math.round(nextCapUsd * 100) / 100;
  return {
    policy: {
      ...policy,
      monthly_platform_cap_usd: rounded,
    },
  };
}

export function summarizeBudgetPolicy(
  policy: WorkspaceBudgetPolicy,
  workflows: WorkflowBundle[]
): BudgetSummary {
  const totalAllocatedUsd = Number(
    policy.allocations.reduce((sum, a) => sum + a.monthly_cap_usd, 0).toFixed(2)
  );
  const totalIncurredUsd = Number(
    policy.allocations.reduce((sum, a) => sum + a.incurred_usd, 0).toFixed(2)
  );
  const totalReservedUsd = Number(
    policy.allocations.reduce((sum, a) => sum + a.reserved_usd, 0).toFixed(2)
  );
  const unallocatedReserveUsd = Number(
    (policy.monthly_platform_cap_usd - totalAllocatedUsd).toFixed(2)
  );
  const projectedUtilizationPct =
    policy.monthly_platform_cap_usd > 0
      ? Math.min(
          100,
          Math.round(
            ((totalIncurredUsd + totalReservedUsd) / policy.monthly_platform_cap_usd) * 100
          )
        )
      : 0;

  const workflowCountOverLimit = workflows.filter((wf) => calculateWorkflowSpend(wf).overLimit).length;

  return {
    monthlyPlatformCapUsd: policy.monthly_platform_cap_usd,
    totalAllocatedUsd,
    unallocatedReserveUsd,
    allocationOverPlatformCap: totalAllocatedUsd > policy.monthly_platform_cap_usd,
    totalIncurredUsd,
    totalReservedUsd,
    projectedUtilizationPct,
    workflowCountOverLimit,
  };
}
