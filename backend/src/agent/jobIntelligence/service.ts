import { logger } from "../../utils/logger.js";
import {
  JobIntelligenceProfile,
  IJobIntelligenceProfile,
  ISkillProfile,
} from "../../models/JobIntelligenceProfile.js";
import { fetchSerpApiGoogleJobs } from "./serpApiClient.js";
import { deduplicateJobPostings } from "./deduplication.js";
import { extractJobProfileWithLLM } from "./llmExtractor.js";
import { normalizeSkillName } from "./skillNormalizer.js";
import { enforceUserRateLimit } from "./rateLimiter.js";

export interface JobIntelligenceOptions {
  userId?: string;
  forceRefresh?: boolean;
  gl?: string;
  hl?: string;
}

/**
 * Normalizes query string inputs for consistent cache lookup keys.
 */
export function normalizeQueryTerm(term?: string): string {
  if (!term || typeof term !== "string") return "";
  return term.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Main service function to fetch, extract, normalize, and cache job market intelligence profile.
 */
export async function getJobIntelligence(
  company: string,
  role: string,
  location: string,
  options: JobIntelligenceOptions = {}
): Promise<IJobIntelligenceProfile> {
  const cleanCompany = normalizeQueryTerm(company);
  const cleanRole = normalizeQueryTerm(role);
  const cleanLocation = normalizeQueryTerm(location);

  if (!cleanRole || !cleanLocation) {
    throw new Error("Both 'role' and 'location' are required parameters.");
  }

  const cacheKey = `${cleanCompany}|${cleanRole}|${cleanLocation}`;
  const now = new Date();

  // 1. Check MongoDB Cache (TTL ~7 days)
  if (!options.forceRefresh) {
    const cachedProfile = await JobIntelligenceProfile.findOne({
      normalizedQueryKey: cacheKey,
      expiresAt: { $gt: now },
    });

    if (cachedProfile) {
      logger.info(`[CACHE HIT] Found fresh job intelligence profile for key "${cacheKey}"`, {
        company,
        role,
        location,
        isFallback: cachedProfile.isFallback,
        coverage: cachedProfile.coverage,
        expiresAt: cachedProfile.expiresAt,
      });
      return cachedProfile;
    }
  }

  logger.info(`[CACHE MISS] Fetching live job postings from SerpApi for key "${cacheKey}"`, {
    company,
    role,
    location,
  });

  // 2. Enforce per-user rate limit for external SerpApi calls (After cache check)
  enforceUserRateLimit(options.userId);

  let isFallback = false;
  let fallbackReason: string | undefined = undefined;
  let query = cleanCompany ? `${company} ${role}` : role;

  // 3. Primary SerpApi Fetch
  let serpApiResult = await fetchSerpApiGoogleJobs({
    query,
    company: company || "General",
    role,
    location,
    gl: options.gl,
    hl: options.hl,
    isFallback: false,
  });

  // 4. Sparse Data Fallback Logic
  if (serpApiResult.postingsCount === 0 && cleanCompany) {
    logger.warn(
      `[SPARSE DATA DETECTED] No postings returned for company="${company}". Triggering fallback search for role="${role}".`
    );
    isFallback = true;
    fallbackReason = `No specific job postings found for company "${company}". Broader market results for role "${role}" were retrieved.`;
    query = role;

    serpApiResult = await fetchSerpApiGoogleJobs({
      query,
      company: company || "General",
      role,
      location,
      gl: options.gl,
      hl: options.hl,
      isFallback: true,
    });
  }

  const rawPostings = serpApiResult.postings;
  const totalPostingsCount = serpApiResult.postingsCount;

  // 5. Posting Deduplication
  const deduplicatedPostings = deduplicateJobPostings(rawPostings);
  const analyzedCount = deduplicatedPostings.length;

  logger.info("Job postings retrieved and deduplicated", {
    totalFetched: totalPostingsCount,
    analyzedCount,
    isFallback,
  });

  // 6. LLM Extraction Step (with schema validation, retry, & heuristic fallback)
  const llmResult = await extractJobProfileWithLLM(deduplicatedPostings, isFallback);

  // 7. Skill Normalization and Frequency Aggregation
  const skillMap = new Map<
    string,
    {
      originalName: string;
      category: string;
      frequency: number;
      priority: "must-have" | "nice-to-have";
    }
  >();

  for (const s of llmResult.skills) {
    const normName = normalizeSkillName(s.name);
    if (!normName) continue;

    const existing = skillMap.get(normName);
    if (existing) {
      existing.frequency += s.frequency || 1;
      if (s.priority === "must-have") {
        existing.priority = "must-have";
      }
    } else {
      skillMap.set(normName, {
        originalName: s.name,
        category: s.category || "General",
        frequency: s.frequency || 1,
        priority: s.priority || "must-have",
      });
    }
  }

  const normalizedSkillsList: ISkillProfile[] = Array.from(skillMap.entries()).map(
    ([normName, item]) => {
      const percentage =
        analyzedCount > 0
          ? Math.min(100, Math.round((item.frequency / analyzedCount) * 100))
          : 0;

      return {
        name: item.originalName,
        normalizedName: normName,
        category: item.category,
        frequency: item.frequency,
        percentage,
        priority: item.priority,
      };
    }
  );

  // Sort skills by priority (must-have first) then frequency descending
  normalizedSkillsList.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority === "must-have" ? -1 : 1;
    }
    return b.frequency - a.frequency;
  });

  // 8. Construct Profile Payload
  const ttlDays = 7;
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

  const profileData = {
    normalizedQueryKey: cacheKey,
    company: company || "General",
    role,
    location,
    isFallback,
    fallbackReason,
    coverage: llmResult.coverage || (analyzedCount > 0 ? "medium" : "none"),
    postingsCount: totalPostingsCount,
    analyzedPostingsCount: analyzedCount,
    skills: normalizedSkillsList,
    seniorityDistribution: llmResult.seniorityDistribution,
    employmentTypes: llmResult.employmentTypes,
    commonResponsibilities: llmResult.commonResponsibilities,
    commonQualifications: llmResult.commonQualifications,
    fetchedAt: now,
    expiresAt,
  };

  // 9. Persist to MongoDB (Upsert by normalizedQueryKey)
  const profile = await JobIntelligenceProfile.findOneAndUpdate(
    { normalizedQueryKey: cacheKey },
    profileData,
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );

  logger.info(`Successfully stored normalized job intelligence profile for key "${cacheKey}"`, {
    isFallback,
    coverage: profile.coverage,
    skillsExtracted: profile.skills.length,
    expiresAt: profile.expiresAt,
  });

  return profile;
}
