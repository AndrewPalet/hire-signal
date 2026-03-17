import { LEVER_BASE_URL } from '../shared/config.js';
import type { JobFetcher, JobListing } from './fetcher.js';

interface LeverJob {
  id: string;
  text: string;
  hostedUrl: string;
  createdAt: number;
  descriptionPlain: string | null;
  categories: {
    location: string;
  };
}

export class LeverFetcher implements JobFetcher {
  async fetchListings(companyId: string): Promise<JobListing[]> {
    try {
      const res = await fetch(`${LEVER_BASE_URL}/${companyId}?mode=json`);
      if (!res.ok) {
        console.error(`  ⚠ Failed to fetch Lever jobs for ${companyId}: ${res.status}`);
        return [];
      }
      const data = (await res.json()) as LeverJob[];
      return data.map((job) => ({
        externalId: job.id,
        title: job.text,
        location: job.categories?.location || null,
        url: job.hostedUrl,
        postedAt: job.createdAt ? new Date(job.createdAt).toISOString() : null,
        description: job.descriptionPlain || null,
      }));
    } catch (err) {
      console.error(`  ⚠ Error fetching Lever jobs for ${companyId}:`, err);
      return [];
    }
  }

  async fetchDescription(companyId: string, externalId: string): Promise<string | null> {
    const listings = await this.fetchListings(companyId);
    const match = listings.find((l) => l.externalId === externalId);
    return match?.description ?? null;
  }
}
