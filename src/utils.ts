export function stripHtml(html: string): string {
  let text = html.replace(/<[^>]*>/g, '');

  text = text
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');

  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

export function truncateDescription(desc: string, maxChars = 8000): string {
  if (desc.length <= maxChars) return desc;
  return desc.slice(0, maxChars) + '\n\n[Description truncated]';
}
