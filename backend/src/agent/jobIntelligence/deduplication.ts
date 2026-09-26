/**
 * Job Posting Deduplication Utility
 * Removes duplicate job postings returned by SerpApi based on job_id, share_link/link, or title+company key.
 */

export interface RawJobPosting {
  job_id?: string;
  title?: string;
  company_name?: string;
  location?: string;
  via?: string;
  share_link?: string;
  link?: string;
  description?: string;
  job_highlights?: Array<{
    title?: string;
    items?: string[];
  }>;
  detected_extensions?: Record<string, any>;
  [key: string]: any;
}

export function deduplicateJobPostings(postings: RawJobPosting[]): RawJobPosting[] {
  if (!Array.isArray(postings) || postings.length === 0) return [];

  const seenKeys = new Set<string>();
  const deduplicated: RawJobPosting[] = [];

  for (const posting of postings) {
    if (!posting || typeof posting !== "object") continue;

    // Try primary key: job_id
    let key = posting.job_id ? `id:${posting.job_id.trim()}` : null;

    // Secondary key: share_link or link
    if (!key && (posting.share_link || posting.link)) {
      const linkStr = (posting.share_link || posting.link)!.trim().toLowerCase();
      key = `link:${linkStr}`;
    }

    // Tertiary key: normalized title + company_name + location
    if (!key) {
      const title = (posting.title || "").trim().toLowerCase();
      const company = (posting.company_name || "").trim().toLowerCase();
      const loc = (posting.location || "").trim().toLowerCase();
      key = `composite:${title}|${company}|${loc}`;
    }

    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      deduplicated.push(posting);
    }
  }

  return deduplicated;
}
