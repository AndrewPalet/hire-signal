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

export async function fetchJobs(companyId: string): Promise<GreenhouseJobSummary[]> {
  try {
    const res = await fetch(`${GREENHOUSE_BASE_URL}/${companyId}/jobs`);
    if (!res.ok) {
      console.error(`  ⚠ Failed to fetch jobs for ${companyId}: ${res.status}`);
      return [];
    }
    const data = (await res.json()) as { jobs: GreenhouseJobSummary[] };
    return data.jobs;
  } catch (err) {
    console.error(`  ⚠ Error fetching jobs for ${companyId}:`, err);
    return [];
  }
}

export async function fetchJobDetail(
  companyId: string,
  jobId: number,
): Promise<GreenhouseJobDetail | null> {
  try {
    const res = await fetch(`${GREENHOUSE_BASE_URL}/${companyId}/jobs/${jobId}`);
    if (!res.ok) {
      console.error(`  ⚠ Failed to fetch detail for ${companyId}/${jobId}: ${res.status}`);
      return null;
    }
    return (await res.json()) as GreenhouseJobDetail;
  } catch (err) {
    console.error(`  ⚠ Error fetching detail for ${companyId}/${jobId}:`, err);
    return null;
  }
}
