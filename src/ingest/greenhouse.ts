import { GREENHOUSE_BASE_URL } from '../shared/config.js';
import { stripHtml } from '../shared/utils.js';
import type { JobFetcher, JobListing } from './fetcher.js';

interface GreenhouseJobSummary {
  id: number;
  title: string;
  location: { name: string };
  absolute_url: string;
  updated_at: string;
}

interface GreenhouseJobDetail extends GreenhouseJobSummary {
  content: string;
}

export class GreenhouseFetcher implements JobFetcher {
  async fetchListings(companyId: string): Promise<JobListing[]> {
    try {
      const res = await fetch(`${GREENHOUSE_BASE_URL}/${companyId}/jobs`);
      if (!res.ok) {
        console.error(`  ⚠ Failed to fetch jobs for ${companyId}: ${res.status}`);
        return [];
      }
      const data = (await res.json()) as { jobs: GreenhouseJobSummary[] };
      return data.jobs.map((job) => ({
        externalId: String(job.id),
        title: job.title,
        location: job.location.name,
        url: job.absolute_url,
        postedAt: job.updated_at,
        description: null,
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
      const detail = (await res.json()) as GreenhouseJobDetail;
      return detail.content ? stripHtml(detail.content) : null;
    } catch (err) {
      console.error(`  ⚠ Error fetching detail for ${companyId}/${externalId}:`, err);
      return null;
    }
  }
}
