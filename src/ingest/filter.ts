import { EXCLUDE_KEYWORDS, INCLUDE_KEYWORDS } from '../shared/config.js';

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
