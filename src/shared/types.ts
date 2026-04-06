export interface JobRow {
  id: string;
  external_id: string;
  company_name: string;
  company_id: string;
  title: string;
  location: string | null;
  url: string;
  description: string | null;
  posted_at: string | null;
  first_seen_at?: string;
  passed_filter: number;
  is_seed: number;
  applied: number;
  notified: number;
  role_fit_score?: number | null;
  role_fit_reasoning?: string | null;
  location_score?: number | null;
  location_reasoning?: string | null;
  stack_score?: number | null;
  stack_reasoning?: string | null;
  comp_score?: number | null;
  comp_reasoning?: string | null;
  overall_score?: number | null;
  overall_reasoning?: string | null;
  dealbreaker?: string | null;
  scored_at?: string | null;
  seen_at?: string | null;
  discord_message_id?: string | null;
  archived_at?: string | null;
}

export interface ScoreResult {
  role_fit_score: number;
  role_fit_reasoning: string;
  location_score: number;
  location_reasoning: string;
  stack_score: number;
  stack_reasoning: string;
  comp_score: number;
  comp_reasoning: string;
  overall_score: number;
  overall_reasoning: string;
  dealbreaker: string | null;
}

export type JobInput = Omit<JobRow, 'first_seen_at' | 'applied' | 'notified' | 'archived_at'>;

export interface DbStats {
  total: number;
  filtered: number;
  seeded: number;
  scored: number;
}
