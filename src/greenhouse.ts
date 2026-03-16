import { GREENHOUSE_BASE_URL } from './config.js';

export interface GreenhouseJobSummary {
  id: number;
  title: string;
  location: { name: string };
  absolute_url: string;
  updated_at: string;
}

export interface GreenhouseJobDetail extends GreenhouseJobSummary {
  content: string;
}

export async function fetchJobs(boardId: string): Promise<GreenhouseJobSummary[]> {
  try {
    const res = await fetch(`${GREENHOUSE_BASE_URL}/${boardId}/jobs`);
    if (!res.ok) {
      console.error(`  ⚠ Failed to fetch jobs for ${boardId}: ${res.status}`);
      return [];
    }
    const data = (await res.json()) as { jobs: GreenhouseJobSummary[] };
    return data.jobs;
  } catch (err) {
    console.error(`  ⚠ Error fetching jobs for ${boardId}:`, err);
    return [];
  }
}

export async function fetchJobDetail(
  boardId: string,
  jobId: number,
): Promise<GreenhouseJobDetail | null> {
  try {
    const res = await fetch(`${GREENHOUSE_BASE_URL}/${boardId}/jobs/${jobId}`);
    if (!res.ok) {
      console.error(`  ⚠ Failed to fetch detail for ${boardId}/${jobId}: ${res.status}`);
      return null;
    }
    return (await res.json()) as GreenhouseJobDetail;
  } catch (err) {
    console.error(`  ⚠ Error fetching detail for ${boardId}/${jobId}:`, err);
    return null;
  }
}
