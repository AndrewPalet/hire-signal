import { GREENHOUSE_BASE_URL } from '../shared/config.js';
import { stripHtml } from '../shared/utils.js';
import type { JobFetcher, JobListing } from './fetcher.js';

interface GreenhouseJob {
  id: number;
  title: string;
  location: { name: string };
  absolute_url: string;
  updated_at: string;
  content?: string;
}

export class GreenhouseFetcher implements JobFetcher {
  async fetchListings(companyId: string): Promise<JobListing[]> {
    try {
      const res = await fetch(`${GREENHOUSE_BASE_URL}/${companyId}/jobs?content=true`);
      if (!res.ok) {
        console.error(`  ⚠ Failed to fetch jobs for ${companyId}: ${res.status}`);
        return [];
      }
      const data = (await res.json()) as { jobs: GreenhouseJob[] };
      return data.jobs.map((job) => ({
        externalId: String(job.id),
        title: job.title,
        location: job.location.name,
        url: job.absolute_url,
        postedAt: job.updated_at,
        description: job.content ? stripHtml(job.content) : null,
      }));
    } catch (err) {
      console.error(`  ⚠ Error fetching jobs for ${companyId}:`, err);
      return [];
    }
  }

  async fetchDescription(companyId: string, externalId: string): Promise<string | null> {
    try {
      const res = await fetch(`${GREENHOUSE_BASE_URL}/${companyId}/jobs/${externalId}`);
      if (!res.ok) {
        console.error(`  ⚠ Failed to fetch detail for ${companyId}/${externalId}: ${res.status}`);
        return null;
      }
      const detail = (await res.json()) as GreenhouseJob;
      return detail.content ? stripHtml(detail.content) : null;
    } catch (err) {
      console.error(`  ⚠ Error fetching detail for ${companyId}/${externalId}:`, err);
      return null;
    }
  }
}
