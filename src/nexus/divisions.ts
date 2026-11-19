import type { NacsCapability, NacsModality, PermissionScope } from '../nacs/v1/types';

export type NexusDivisionId =
  | 'research'
  | 'creator'
  | 'production'
  | 'marketing'
  | 'growth'
  | 'business_intelligence'
  | 'security';

export type AgentRuntimeBinding = 'adapter_unbound' | 'policy_engine_local' | 'approval_gated';

export interface DivisionAgentSpec {
  agent_id: string;
  name: string;
  role: string;
  division_id: NexusDivisionId;
  production_track: 'creative' | 'general_automation';
  runtime_binding: AgentRuntimeBinding;
  binding_note: string;
  required_capabilities: NacsCapability[];
  required_modalities: NacsModality[];
  required_scopes: PermissionScope[];
  human_approval_required: boolean;
  estimated_task_cap_usd: number;
  data_sensitivity: 'public' | 'internal' | 'confidential' | 'restricted';
}

export interface NexusDivision {
  id: NexusDivisionId;
  name: string;
  shortName: string;
  mandate: string;
  primaryTrack: 'creative' | 'general_automation' | 'cross_track';
  defaultMonthlyCapUsd: number;
  approvalPolicy: string;
  keyOutputs: string[];
  nacsCapabilities: NacsCapability[];
  agents: DivisionAgentSpec[];
}

export const NEXUS_DIVISIONS: readonly NexusDivision[] = [
  {
    id: 'research',
    name: 'Research Division',
    shortName: 'Research',
    mandate:
      'Source-grounded market discovery, technical feasibility audits, competitive analysis, and structured knowledge synthesis.',
    primaryTrack: 'cross_track',
    defaultMonthlyCapUsd: 180,
    approvalPolicy: 'Read-only research allowed in hybrid mode; external scraping/paid datasets blocked.',
    keyOutputs: ['research', 'documents'],
    nacsCapabilities: ['research', 'structured_reasoning', 'document_generation'],
    agents: [
      {
        agent_id: 'nx_res_market_01',
        name: 'Market Intelligence Analyst',
        role: 'Competitive & audience discovery',
        division_id: 'research',
        production_track: 'general_automation',
        runtime_binding: 'adapter_unbound',
        binding_note: 'Blueprint registered; external model adapter not bound (zero paid calls).',
        required_capabilities: ['research', 'structured_reasoning'],
        required_modalities: ['text', 'json'],
        required_scopes: ['model.invoke'],
        human_approval_required: false,
        estimated_task_cap_usd: 0.45,
        data_sensitivity: 'internal',
      },
      {
        agent_id: 'nx_res_repo_02',
        name: 'Technical & Codebase Auditor',
        role: 'Static contract & API surface research',
        division_id: 'research',
        production_track: 'general_automation',
        runtime_binding: 'adapter_unbound',
        binding_note: 'Blueprint registered; scoped to read-only repo inspection.',
        required_capabilities: ['research', 'structured_reasoning'],
        required_modalities: ['text', 'code', 'json'],
        required_scopes: ['model.invoke', 'repo.read'],
        human_approval_required: false,
        estimated_task_cap_usd: 0.5,
        data_sensitivity: 'confidential',
      },
    ],
  },
  {
    id: 'creator',
    name: 'Creator Division',
    shortName: 'Creator',
    mandate:
      'Narrative architecture, multilingual screenplays, visual storyboards, and creative briefs bound by style and language constraints.',
    primaryTrack: 'creative',
    defaultMonthlyCapUsd: 240,
    approvalPolicy: 'Internal creative drafts allowed; external asset licensing requires human approval.',
    keyOutputs: ['screenplay', 'storyboard', 'documents'],
    nacsCapabilities: ['screenplay', 'storyboard', 'document_generation'],
    agents: [
      {
        agent_id: 'nx_crt_script_01',
        name: 'Narrative & Screenplay Architect',
        role: 'Multilingual screenplay & dialogue pacing',
        division_id: 'creator',
        production_track: 'creative',
        runtime_binding: 'adapter_unbound',
        binding_note: 'Blueprint registered; awaits authorized creative text provider.',
        required_capabilities: ['screenplay'],
        required_modalities: ['text', 'json'],
        required_scopes: ['model.invoke'],
        human_approval_required: false,
        estimated_task_cap_usd: 0.6,
        data_sensitivity: 'internal',
      },
      {
        agent_id: 'nx_crt_board_02',
        name: 'Storyboard & Shot Director',
        role: 'Frame composition, camera grammar, and shot lists',
        division_id: 'creator',
        production_track: 'creative',
        runtime_binding: 'adapter_unbound',
        binding_note: 'Blueprint registered; awaits authorized multimodal provider.',
        required_capabilities: ['storyboard', 'image_generation'],
        required_modalities: ['text', 'image'],
        required_scopes: ['model.invoke', 'media.generate'],
        human_approval_required: false,
        estimated_task_cap_usd: 0.9,
        data_sensitivity: 'internal',
      },
    ],
  },
  {
    id: 'production',
    name: 'Production Division',
    shortName: 'Production',
    mandate:
      'Media rendering, audio synthesis, software engineering, web bundle assembly, and automated QA verification prior to release.',
    primaryTrack: 'cross_track',
    defaultMonthlyCapUsd: 420,
    approvalPolicy: 'GPU media compute above cap and repository writes require explicit budget/policy checks.',
    keyOutputs: ['images', 'video', 'audio', 'final_render', 'code', 'website'],
    nacsCapabilities: [
      'image_generation',
      'video_generation',
      'audio_generation',
      'media_editing',
      'code_generation',
      'web_development',
      'quality_inspection',
    ],
    agents: [
      {
        agent_id: 'nx_prd_media_01',
        name: 'Media Synthesis & Finishing Engine',
        role: 'Keyframe, video, and audio assembly pipeline',
        division_id: 'production',
        production_track: 'creative',
        runtime_binding: 'approval_gated',
        binding_note: 'High-compute media generation gated by budget cap and human sign-off.',
        required_capabilities: ['image_generation', 'video_generation', 'audio_generation'],
        required_modalities: ['image', 'video', 'audio'],
        required_scopes: ['model.invoke', 'media.generate'],
        human_approval_required: true,
        estimated_task_cap_usd: 2.2,
        data_sensitivity: 'internal',
      },
      {
        agent_id: 'nx_prd_eng_02',
        name: 'Full-Stack Code Synthesizer',
        role: 'Typed TypeScript adapters, tests, and web bundles',
        division_id: 'production',
        production_track: 'general_automation',
        runtime_binding: 'adapter_unbound',
        binding_note: 'Blueprint registered; requires zero-retention code provider.',
        required_capabilities: ['code_generation', 'web_development'],
        required_modalities: ['text', 'code', 'json'],
        required_scopes: ['model.invoke', 'repo.read', 'document.write'],
        human_approval_required: false,
        estimated_task_cap_usd: 0.75,
        data_sensitivity: 'confidential',
      },
      {
        agent_id: 'nx_prd_qa_03',
        name: 'Quality & Contract Inspector',
        role: 'Output schema verification and artifact provenance checks',
        division_id: 'production',
        production_track: 'general_automation',
        runtime_binding: 'policy_engine_local',
        binding_note: 'Deterministic contract validation active locally via NACS Ajv 2020 engine.',
        required_capabilities: ['quality_inspection', 'structured_reasoning'],
        required_modalities: ['text', 'json'],
        required_scopes: ['model.invoke'],
        human_approval_required: false,
        estimated_task_cap_usd: 0.25,
        data_sensitivity: 'internal',
      },
    ],
  },
  {
    id: 'marketing',
    name: 'Marketing Division',
    shortName: 'Marketing',
    mandate:
      'Campaign positioning, launch documentation, distribution packaging, and channel-ready metadata under strict publishing gates.',
    primaryTrack: 'cross_track',
    defaultMonthlyCapUsd: 160,
    approvalPolicy: 'All public_publishing actions are hard-blocked until SHA-256 payload-bound human approval.',
    keyOutputs: ['documents', 'published_release'],
    nacsCapabilities: ['document_generation', 'external_publish'],
    agents: [
      {
        agent_id: 'nx_mkt_campaign_01',
        name: 'Launch Collateral Composer',
        role: 'Positioning briefs, landing copy, and release notes',
        division_id: 'marketing',
        production_track: 'general_automation',
        runtime_binding: 'adapter_unbound',
        binding_note: 'Blueprint registered; drafts remain workspace-private until approved.',
        required_capabilities: ['document_generation', 'structured_reasoning'],
        required_modalities: ['text', 'document'],
        required_scopes: ['model.invoke', 'document.write'],
        human_approval_required: false,
        estimated_task_cap_usd: 0.4,
        data_sensitivity: 'internal',
      },
      {
        agent_id: 'nx_mkt_publish_02',
        name: 'Distribution Release Gatekeeper',
        role: 'Channel scheduling & public release packaging',
        division_id: 'marketing',
        production_track: 'creative',
        runtime_binding: 'approval_gated',
        binding_note: 'External publishing disabled in Stage 1; strictly requires human approval.',
        required_capabilities: ['external_publish'],
        required_modalities: ['text', 'json'],
        required_scopes: ['external.publish'],
        human_approval_required: true,
        estimated_task_cap_usd: 0.15,
        data_sensitivity: 'internal',
      },
    ],
  },
  {
    id: 'growth',
    name: 'Growth Division',
    shortName: 'Growth',
    mandate:
      'Activation funnel workflows, retention experiments, lifecycle orchestration, and outbound messaging drafts with mandatory human gates.',
    primaryTrack: 'general_automation',
    defaultMonthlyCapUsd: 150,
    approvalPolicy: 'External messaging and billing/purchase triggers denied without explicit human authorization.',
    keyOutputs: ['workflow_automation', 'documents'],
    nacsCapabilities: ['business_workflow', 'external_message'],
    agents: [
      {
        agent_id: 'nx_grw_funnel_01',
        name: 'Lifecycle Workflow Designer',
        role: 'Experiment hypotheses & onboarding workflow specs',
        division_id: 'growth',
        production_track: 'general_automation',
        runtime_binding: 'adapter_unbound',
        binding_note: 'Blueprint registered; executes offline workflow spec drafting only.',
        required_capabilities: ['business_workflow', 'structured_reasoning'],
        required_modalities: ['text', 'json'],
        required_scopes: ['model.invoke', 'document.write'],
        human_approval_required: false,
        estimated_task_cap_usd: 0.35,
        data_sensitivity: 'internal',
      },
      {
        agent_id: 'nx_grw_outreach_02',
        name: 'Outbound Dispatch Coordinator',
        role: 'External customer messaging & notification dispatch',
        division_id: 'growth',
        production_track: 'general_automation',
        runtime_binding: 'approval_gated',
        binding_note: 'External messaging permanently blocked in Stage 1; human gate mandatory.',
        required_capabilities: ['external_message'],
        required_modalities: ['text', 'json'],
        required_scopes: ['external.message'],
        human_approval_required: true,
        estimated_task_cap_usd: 0.15,
        data_sensitivity: 'confidential',
      },
    ],
  },
  {
    id: 'business_intelligence',
    name: 'Business Intelligence Division',
    shortName: 'Business Intel',
    mandate:
      'Unit-cost accounting, workflow throughput forecasting, budget utilization telemetry, and executive decision briefings.',
    primaryTrack: 'general_automation',
    defaultMonthlyCapUsd: 140,
    approvalPolicy: 'Internal telemetry aggregation allowed; financial transactions and billing changes blocked.',
    keyOutputs: ['research', 'documents', 'qa_report'],
    nacsCapabilities: ['structured_reasoning', 'research', 'document_generation'],
    agents: [
      {
        agent_id: 'nx_bi_cost_01',
        name: 'Cost & Unit-Economics Analyst',
        role: 'Spend forecasting, provider cost benchmarking, and cap alerts',
        division_id: 'business_intelligence',
        production_track: 'general_automation',
        runtime_binding: 'policy_engine_local',
        binding_note: 'Deterministic spend rollups active locally on contract ledger data.',
        required_capabilities: ['structured_reasoning', 'document_generation'],
        required_modalities: ['text', 'json'],
        required_scopes: ['model.invoke'],
        human_approval_required: false,
        estimated_task_cap_usd: 0.3,
        data_sensitivity: 'confidential',
      },
      {
        agent_id: 'nx_bi_kpi_02',
        name: 'Executive Operations Briefer',
        role: 'Cross-division SLA and bottleneck synthesis',
        division_id: 'business_intelligence',
        production_track: 'general_automation',
        runtime_binding: 'adapter_unbound',
        binding_note: 'Blueprint registered; awaits zero-retention analytics provider.',
        required_capabilities: ['research', 'document_generation'],
        required_modalities: ['text', 'document'],
        required_scopes: ['model.invoke', 'document.write'],
        human_approval_required: false,
        estimated_task_cap_usd: 0.4,
        data_sensitivity: 'confidential',
      },
    ],
  },
  {
    id: 'security',
    name: 'Security Division',
    shortName: 'Security',
    mandate:
      'Default-deny capability enforcement, secret-leak scanning, prompt-injection override blocking, tenant isolation, and approval payload verification.',
    primaryTrack: 'cross_track',
    defaultMonthlyCapUsd: 110,
    approvalPolicy: 'Local deterministic NACS security engine always active; destructive/account ops blocked.',
    keyOutputs: ['qa_report', 'documents'],
    nacsCapabilities: ['quality_inspection', 'structured_reasoning'],
    agents: [
      {
        agent_id: 'nx_sec_guard_01',
        name: 'Policy & Secret Hygiene Guard',
        role: 'Secret leak detection, redaction, and override defense',
        division_id: 'security',
        production_track: 'general_automation',
        runtime_binding: 'policy_engine_local',
        binding_note: 'Active locally via src/nacs/v1/security.ts and contracts/v1.0/ts/policy.ts.',
        required_capabilities: ['quality_inspection', 'structured_reasoning'],
        required_modalities: ['text', 'json'],
        required_scopes: ['model.invoke'],
        human_approval_required: false,
        estimated_task_cap_usd: 0.1,
        data_sensitivity: 'restricted',
      },
      {
        agent_id: 'nx_sec_audit_02',
        name: 'Tenant & Approval Verifier',
        role: 'SHA-256 payload binding and workspace boundary verification',
        division_id: 'security',
        production_track: 'general_automation',
        runtime_binding: 'policy_engine_local',
        binding_note: 'Active locally via contracts/v1.0/ts/policy.ts.',
        required_capabilities: ['quality_inspection'],
        required_modalities: ['json'],
        required_scopes: ['model.invoke'],
        human_approval_required: false,
        estimated_task_cap_usd: 0.1,
        data_sensitivity: 'restricted',
      },
    ],
  },
];

export function getAllDivisionAgents(): DivisionAgentSpec[] {
  return NEXUS_DIVISIONS.flatMap((div) => div.agents);
}

export function getDivisionById(id: NexusDivisionId): NexusDivision | undefined {
  return NEXUS_DIVISIONS.find((d) => d.id === id);
}

export function summarizeDivisionReadiness(): {
  totalDivisions: number;
  totalAgents: number;
  localPolicyEngines: number;
  approvalGatedAgents: number;
  unboundBlueprints: number;
} {
  const agents = getAllDivisionAgents();
  return {
    totalDivisions: NEXUS_DIVISIONS.length,
    totalAgents: agents.length,
    localPolicyEngines: agents.filter((a) => a.runtime_binding === 'policy_engine_local').length,
    approvalGatedAgents: agents.filter((a) => a.runtime_binding === 'approval_gated').length,
    unboundBlueprints: agents.filter((a) => a.runtime_binding === 'adapter_unbound').length,
  };
}
