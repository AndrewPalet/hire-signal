import type { AtsSource } from '../shared/config.js';
import { GreenhouseFetcher } from './greenhouse.js';
import { AshbyFetcher } from './ashby.js';
import { LeverFetcher } from './lever.js';

export interface JobListing {
  externalId: string;
  title: string;
  location: string | null;
  url: string;
  postedAt: string | null;
  description: string | null;
}

export interface JobFetcher {
  fetchListings(companyId: string): Promise<JobListing[]>;
  fetchDescription(companyId: string, externalId: string): Promise<string | null>;
}

const fetchers: Record<AtsSource, JobFetcher> = {
  greenhouse: new GreenhouseFetcher(),
  ashby: new AshbyFetcher(),
  lever: new LeverFetcher(),
};

export function getFetcher(source: AtsSource): JobFetcher {
  return fetchers[source];
}
