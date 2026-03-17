import { ASHBY_BASE_URL } from '../shared/config.js';
import type { JobFetcher, JobListing } from './fetcher.js';

interface AshbyJob {
  id: string;
  title: string;
  location: string;
  jobUrl: string;
  publishedAt: string;
  descriptionPlain: string | null;
}

interface AshbyBoardResponse {
  jobs: AshbyJob[];
}

export class AshbyFetcher implements JobFetcher {
  async fetchListings(companyId: string): Promise<JobListing[]> {
    try {
      const res = await fetch(`${ASHBY_BASE_URL}/${companyId}`);
      if (!res.ok) {
        console.error(`  ⚠ Failed to fetch Ashby jobs for ${companyId}: ${res.status}`);
        return [];
      }
      const data = (await res.json()) as AshbyBoardResponse;
      return data.jobs.map((job) => ({
        externalId: job.id,
        title: job.title,
        location: job.location || null,
        url: job.jobUrl,
        postedAt: job.publishedAt || null,
        description: job.descriptionPlain || null,
      }));
    } catch (err) {
      console.error(`  ⚠ Error fetching Ashby jobs for ${companyId}:`, err);
      return [];
    }
  }

  async fetchDescription(companyId: string, externalId: string): Promise<string | null> {
    const listings = await this.fetchListings(companyId);
    const match = listings.find((l) => l.externalId === externalId);
    return match?.description ?? null;
  }
}
