import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { config } from "../../config/env.js";
import { logger } from "../../utils/logger.js";
import { RawJobPosting } from "./deduplication.js";
import { JOB_INTELLIGENCE_SYSTEM_PROMPT } from "./systemPrompt.js";
import { LlmExtractionResultSchema, LlmExtractionResult } from "./schemas.js";
import { extractHeuristicJobProfile } from "./analysisUtils.js";

/**
 * Formats raw postings into a clean textual payload for the LLM.
 */
function preparePostingsPayload(postings: RawJobPosting[]): string {
  return postings
    .slice(0, 10) // Limit to top 10 postings to stay well within context token limits
    .map((p, idx) => {
      const title = p.title || "Untitled Role";
      const company = p.company_name || "Unknown Company";
      const location = p.location || "Unknown Location";
      const extensions = p.detected_extensions
        ? JSON.stringify(p.detected_extensions)
        : "";

      const highlights = (p.job_highlights || [])
        .map((h) => `${h.title || "Highlight"}:\n - ${(h.items || []).join("\n - ")}`)
        .join("\n");

      const descriptionSnippet = p.description
        ? p.description.slice(0, 800)
        : "No full description provided.";

      return `--- JOB POSTING #${idx + 1} ---
Title: ${title}
Company: ${company}
Location: ${location}
Extensions: ${extensions}

Highlights:
${highlights || "None provided."}

Description Snippet:
${descriptionSnippet}
`;
    })
    .join("\n\n");
}

/**
 * Sanitizes LLM output text by trimming markdown block ticks if present.
 */
function cleanJsonOutput(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  return cleaned.trim();
}

/**
 * Invokes Gemini (or fallback LLM) to generate completion text.
 */
async function generateLlmCompletion(userPrompt: string): Promise<string> {
  const provider = (config.LLM_PROVIDER || "gemini").toLowerCase();
  const geminiApiKey = config.GEMINI_API_KEY || process.env.GEMINI_API_KEY;

  if (provider === "gemini" || geminiApiKey) {
    if (!geminiApiKey) {
      throw new Error("GEMINI_API_KEY is missing from environment variables.");
    }

    logger.info("Calling Google Gemini API...", { model: config.GEMINI_MODEL });
    const ai = new GoogleGenAI({ apiKey: geminiApiKey });
    const response = await ai.models.generateContent({
      model: config.GEMINI_MODEL || "gemini-2.5-flash",
      contents: userPrompt,
      config: {
        systemInstruction: JOB_INTELLIGENCE_SYSTEM_PROMPT,
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    });

    return response.text || "";
  }

  if (config.OPENAI_API_KEY) {
    logger.info("Calling OpenAI API fallback...");
    const openai = new OpenAI({
      apiKey: config.OPENAI_API_KEY,
      baseURL: config.OPENAI_BASE_URL || undefined,
    });

    const completion = await openai.chat.completions.create({
      model: config.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: JOB_INTELLIGENCE_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    });

    return completion.choices[0]?.message?.content || "";
  }

  throw new Error("No valid LLM API key configured (GEMINI_API_KEY required).");
}

/**
 * Extracts structured profile using Gemini/LLM with 1 retry on Zod validation failure,
 * falling back to heuristic extraction if LLM is unavailable or fails.
 */
export async function extractJobProfileWithLLM(
  postings: RawJobPosting[],
  isFallbackMode: boolean
): Promise<LlmExtractionResult> {
  if (!postings || postings.length === 0) {
    return extractHeuristicJobProfile(postings, isFallbackMode);
  }

  const geminiKey = config.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  const openaiKey = config.OPENAI_API_KEY;

  if (!geminiKey && !openaiKey) {
    logger.warn(
      "No GEMINI_API_KEY found in environment. Using safe heuristic extraction fallback for Job Intelligence Agent."
    );
    return extractHeuristicJobProfile(postings, isFallbackMode);
  }

  const postingsPayload = preparePostingsPayload(postings);
  const promptUserMessage = `Please analyze the following ${postings.length} job postings and extract structured skill, seniority, responsibility, and qualification data strictly per instructions:\n\n${postingsPayload}`;

  // Attempt 1
  try {
    logger.info("Executing Gemini extraction call (Attempt 1)...");
    const content = await generateLlmCompletion(promptUserMessage);
    const cleaned = cleanJsonOutput(content);
    const parsedJson = JSON.parse(cleaned);

    const validated = LlmExtractionResultSchema.safeParse(parsedJson);
    if (validated.success) {
      logger.info("Gemini extraction succeeded and passed schema validation (Attempt 1).");
      return validated.data;
    }

    logger.warn("LLM output failed Zod schema validation on Attempt 1. Retrying once...", {
      error: validated.error.format(),
    });

    // Attempt 2 (Retry with validation feedback)
    const retryUserMessage = `${promptUserMessage}\n\n[ATTENTION]: Your previous response failed schema validation with errors: ${JSON.stringify(
      validated.error.format()
    )}. Please correct these errors and ensure strictly valid JSON matching the exact schema.`;

    const retryContent = await generateLlmCompletion(retryUserMessage);
    const retryCleaned = cleanJsonOutput(retryContent);
    const retryParsedJson = JSON.parse(retryCleaned);

    const retryValidated = LlmExtractionResultSchema.safeParse(retryParsedJson);
    if (retryValidated.success) {
      logger.info("Gemini extraction succeeded on Retry (Attempt 2).");
      return retryValidated.data;
    }

    logger.error(
      "Gemini extraction failed schema validation after Retry (Attempt 2). Falling back to safe heuristic extraction."
    );
    return extractHeuristicJobProfile(postings, isFallbackMode);
  } catch (err: any) {
    logger.error("Error encountered during Gemini extraction call", {
      error: err.message,
    });
    logger.info("Falling back to safe heuristic profile extraction.");
    return extractHeuristicJobProfile(postings, isFallbackMode);
  }
}
