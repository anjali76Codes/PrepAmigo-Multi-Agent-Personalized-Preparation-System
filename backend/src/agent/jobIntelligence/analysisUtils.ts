import { RawJobPosting } from "./deduplication.js";
import { normalizeSkillName } from "./skillNormalizer.js";
import { LlmExtractionResult } from "./schemas.js";

/**
 * Analyzes job titles and text to compute seniority distribution and confidence.
 */
export function analyzeSeniority(postings: RawJobPosting[]) {
  const distribution = {
    junior: 0,
    mid: 0,
    senior: 0,
    lead: 0,
    executive: 0,
    unspecified: 0,
    confidence: "insufficient_data" as "high" | "medium" | "low" | "insufficient_data",
  };

  if (!postings || postings.length === 0) {
    return distribution;
  }

  let classifiedCount = 0;

  for (const posting of postings) {
    const title = (posting.title || "").toLowerCase();
    const highlightsText = (posting.job_highlights || [])
      .flatMap((h) => h.items || [])
      .join(" ")
      .toLowerCase();
    const text = `${title} ${highlightsText}`;

    if (/\b(junior|jr|associate|entry level|intern|internship|graduate)\b/i.test(text)) {
      distribution.junior += 1;
      classifiedCount++;
    } else if (/\b(executive|vp|vice president|c-level|cto|ceo|director|head of)\b/i.test(text)) {
      distribution.executive += 1;
      classifiedCount++;
    } else if (/\b(lead|principal|staff|manager|team lead|architect)\b/i.test(text)) {
      distribution.lead += 1;
      classifiedCount++;
    } else if (/\b(senior|sr|snr|lead engineer)\b/i.test(text)) {
      distribution.senior += 1;
      classifiedCount++;
    } else if (/\b(mid|mid-level|intermediate|engineer|developer|analyst)\b/i.test(text)) {
      distribution.mid += 1;
      classifiedCount++;
    } else {
      distribution.unspecified += 1;
    }
  }

  const ratio = classifiedCount / postings.length;
  if (postings.length >= 5 && ratio >= 0.7) {
    distribution.confidence = "high";
  } else if (postings.length >= 2 && ratio >= 0.4) {
    distribution.confidence = "medium";
  } else if (classifiedCount > 0) {
    distribution.confidence = "low";
  } else {
    distribution.confidence = "insufficient_data";
  }

  return distribution;
}

/**
 * Rule-based fallback extraction if LLM call is unavailable or fails schema validation.
 */
export function extractHeuristicJobProfile(
  postings: RawJobPosting[],
  isFallbackMode: boolean
): LlmExtractionResult {
  if (!postings || postings.length === 0) {
    return {
      skills: [],
      seniorityDistribution: {
        junior: 0,
        mid: 0,
        senior: 0,
        lead: 0,
        executive: 0,
        unspecified: 0,
        confidence: "insufficient_data",
      },
      employmentTypes: [],
      commonResponsibilities: [],
      commonQualifications: [],
      coverage: "none",
    };
  }

  const skillCounts: Record<string, { originalName: string; count: number; category: string; isRequired: boolean }> = {};
  const employmentTypesSet = new Set<string>();
  const responsibilities: string[] = [];
  const qualifications: string[] = [];

  // Common tech skills dictionary for regex matching in raw text
  const KNOWN_KEYWORDS: Array<{ pattern: RegExp; canonical: string; category: string }> = [
    { pattern: /\b(react\.?js|react)\b/i, canonical: "React", category: "Frameworks & Libraries" },
    { pattern: /\b(node\.?js|node)\b/i, canonical: "Node.js", category: "Frameworks & Libraries" },
    { pattern: /\b(typescript|ts)\b/i, canonical: "TypeScript", category: "Languages" },
    { pattern: /\b(javascript|js)\b/i, canonical: "JavaScript", category: "Languages" },
    { pattern: /\b(python|py)\b/i, canonical: "Python", category: "Languages" },
    { pattern: /\b(java)\b/i, canonical: "Java", category: "Languages" },
    { pattern: /\b(c\#|csharp)\b/i, canonical: "C#", category: "Languages" },
    { pattern: /\b(c\+\+|cpp)\b/i, canonical: "C++", category: "Languages" },
    { pattern: /\b(go|golang)\b/i, canonical: "Go", category: "Languages" },
    { pattern: /\b(sql|postgresql|postgres)\b/i, canonical: "PostgreSQL", category: "Databases" },
    { pattern: /\b(mongodb|mongo)\b/i, canonical: "MongoDB", category: "Databases" },
    { pattern: /\b(redis)\b/i, canonical: "Redis", category: "Databases" },
    { pattern: /\b(aws|amazon web services)\b/i, canonical: "Amazon Web Services", category: "Cloud & DevOps" },
    { pattern: /\b(gcp|google cloud)\b/i, canonical: "Google Cloud Platform", category: "Cloud & DevOps" },
    { pattern: /\b(azure)\b/i, canonical: "Microsoft Azure", category: "Cloud & DevOps" },
    { pattern: /\b(docker)\b/i, canonical: "Docker", category: "Cloud & DevOps" },
    { pattern: /\b(kubernetes|k8s)\b/i, canonical: "Kubernetes", category: "Cloud & DevOps" },
    { pattern: /\b(git)\b/i, canonical: "Git", category: "Tools" },
    { pattern: /\b(ci\/cd)\b/i, canonical: "CI/CD", category: "Cloud & DevOps" },
    { pattern: /\b(rest|restful)\b/i, canonical: "REST APIs", category: "Architecture" },
    { pattern: /\b(graphql)\b/i, canonical: "GraphQL", category: "Architecture" },
    { pattern: /\b(agile|scrum)\b/i, canonical: "Agile", category: "Methodologies" },
  ];

  for (const posting of postings) {
    // Detect employment type
    if (posting.detected_extensions?.schedule_type) {
      employmentTypesSet.add(posting.detected_extensions.schedule_type);
    }

    const highlights = posting.job_highlights || [];
    let fullText = `${posting.title || ""} ${posting.description || ""}`;

    for (const h of highlights) {
      const sectionTitle = (h.title || "").toLowerCase();
      const items = h.items || [];
      fullText += ` ${items.join(" ")}`;

      if (sectionTitle.includes("qualification") || sectionTitle.includes("requirement")) {
        qualifications.push(...items.slice(0, 3));
      } else if (sectionTitle.includes("responsibilit")) {
        responsibilities.push(...items.slice(0, 3));
      }
    }

    // Match known skills
    for (const kw of KNOWN_KEYWORDS) {
      if (kw.pattern.test(fullText)) {
        const key = kw.canonical.toLowerCase();
        if (!skillCounts[key]) {
          skillCounts[key] = {
            originalName: kw.canonical,
            count: 0,
            category: kw.category,
            isRequired: false,
          };
        }
        skillCounts[key].count += 1;
        if (/qualification|requirement|essential|must/i.test(fullText)) {
          skillCounts[key].isRequired = true;
        }
      }
    }
  }

  const totalPostings = postings.length;
  const skillsList = Object.values(skillCounts).map((item) => {
    const norm = normalizeSkillName(item.originalName);
    const freqRatio = item.count / totalPostings;
    const priority: "must-have" | "nice-to-have" =
      item.isRequired || freqRatio >= 0.4 ? "must-have" : "nice-to-have";

    return {
      name: norm,
      category: item.category,
      priority,
      frequency: item.count,
    };
  });

  const seniority = analyzeSeniority(postings);

  // Coverage score calculation
  let coverageScore: "high" | "medium" | "low" | "none" = "medium";
  if (isFallbackMode) {
    coverageScore = totalPostings >= 3 ? "low" : "low";
  } else if (totalPostings >= 5 && skillsList.length >= 3) {
    coverageScore = "high";
  } else if (totalPostings >= 2 && skillsList.length >= 1) {
    coverageScore = "medium";
  } else {
    coverageScore = "low";
  }

  return {
    skills: skillsList,
    seniorityDistribution: seniority,
    employmentTypes: Array.from(employmentTypesSet).slice(0, 5),
    commonResponsibilities: Array.from(new Set(responsibilities)).slice(0, 5),
    commonQualifications: Array.from(new Set(qualifications)).slice(0, 5),
    coverage: coverageScore,
  };
}
