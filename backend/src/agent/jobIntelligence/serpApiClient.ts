import { getJson } from "serpapi";
import { config } from "../../config/env.js";
import { logger } from "../../utils/logger.js";
import { JobPostingRaw } from "../../models/JobPostingRaw.js";

export class SerpApiError extends Error {
  public statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = "SerpApiError";
    this.statusCode = statusCode;
  }
}

export interface SerpApiJobsParams {
  query: string;
  company: string;
  role: string;
  location: string;
  gl?: string;
  hl?: string;
  isFallback?: boolean;
}

export interface SerpApiJobsResponse {
  rawResponse: Record<string, any>;
  postings: any[];
  postingsCount: number;
}

/**
 * Executes a Google Jobs query via official SerpApi client and persists raw output to job_postings_raw collection.
 */
export async function fetchSerpApiGoogleJobs(
  params: SerpApiJobsParams
): Promise<SerpApiJobsResponse> {
  const apiKey = config.SERPAPI_API_KEY;

  if (!apiKey) {
    logger.error("SERPAPI_API_KEY is not configured in .env");
    throw new SerpApiError(
      "SerpApi API key is missing. Please configure SERPAPI_API_KEY in your environment variables.",
      500
    );
  }

  const searchParams = {
    engine: "google_jobs",
    q: params.query,
    location: params.location,
    gl: params.gl || "us",
    hl: params.hl || "en",
    api_key: apiKey,
  };

  logger.info("Executing SerpApi Google Jobs request", {
    query: params.query,
    location: params.location,
    isFallback: !!params.isFallback,
  });

  try {
    const rawResponse: any = await getJson(searchParams);

    // Check for explicit error fields in SerpApi response JSON
    if (rawResponse && rawResponse.error) {
      const errMsg = rawResponse.error.toString();
      logger.error("SerpApi returned an error response", { error: errMsg });

      if (
        errMsg.toLowerCase().includes("quota") ||
        errMsg.toLowerCase().includes("credit") ||
        errMsg.toLowerCase().includes("limit") ||
        errMsg.toLowerCase().includes("429")
      ) {
        throw new SerpApiError(
          "SerpApi search quota exceeded or rate limit reached. Please try again later.",
          429
        );
      }
      throw new SerpApiError(`SerpApi request failed: ${errMsg}`, 400);
    }

    const postings = Array.isArray(rawResponse.jobs_results)
      ? rawResponse.jobs_results
      : [];

    logger.info("SerpApi Google Jobs request finished", {
      status: "success",
      postingsCount: postings.length,
    });

    // Store raw response in job_postings_raw collection
    await JobPostingRaw.create({
      query: params.query,
      company: params.company,
      role: params.role,
      location: params.location,
      isFallback: !!params.isFallback,
      searchParameters: searchParams,
      rawResponse: rawResponse,
      postingsCount: postings.length,
      createdAt: new Date(),
    });

    return {
      rawResponse,
      postings,
      postingsCount: postings.length,
    };
  } catch (err: any) {
    if (err instanceof SerpApiError) {
      throw err;
    }

    const errMsg = err?.message || String(err);
    logger.error("SerpApi execution error", { error: errMsg });

    if (
      errMsg.toLowerCase().includes("429") ||
      errMsg.toLowerCase().includes("quota") ||
      errMsg.toLowerCase().includes("rate limit") ||
      errMsg.toLowerCase().includes("out of credits")
    ) {
      throw new SerpApiError(
        "SerpApi search quota exceeded or rate limited. Please try again later.",
        429
      );
    }

    throw new SerpApiError(
      `Failed to fetch job postings from SerpApi: ${errMsg}`,
      500
    );
  }
}
