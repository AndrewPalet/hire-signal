import { EXCLUDE_KEYWORDS, INCLUDE_KEYWORDS, STALENESS_THRESHOLD_DAYS } from '../shared/config.js';

export function passesFilter(title: string): boolean {
  const lower = title.toLowerCase();

  for (const keyword of EXCLUDE_KEYWORDS) {
    if (lower.includes(keyword)) return false;
  }

  for (const keyword of INCLUDE_KEYWORDS) {
    if (lower.includes(keyword)) return true;
  }

  return false;
}

export function isFreshEnough(postedAt: string | null): boolean {
  if (!postedAt) return true;
  const posted = new Date(postedAt);
  if (isNaN(posted.getTime())) return true;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - STALENESS_THRESHOLD_DAYS);
  return posted >= cutoff;
}
