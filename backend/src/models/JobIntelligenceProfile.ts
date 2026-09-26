import mongoose, { Schema, Document } from "mongoose";

export interface ISkillProfile {
  name: string;
  normalizedName: string;
  category: string;
  frequency: number;
  percentage: number;
  priority: "must-have" | "nice-to-have";
}

export interface ISeniorityDistribution {
  junior: number;
  mid: number;
  senior: number;
  lead: number;
  executive: number;
  unspecified: number;
  confidence: "high" | "medium" | "low" | "insufficient_data";
}

export interface IJobIntelligenceProfile extends Document {
  normalizedQueryKey: string;
  company: string;
  role: string;
  location: string;
  isFallback: boolean;
  fallbackReason?: string;
  coverage: "high" | "medium" | "low" | "none";
  postingsCount: number;
  analyzedPostingsCount: number;
  skills: ISkillProfile[];
  seniorityDistribution: ISeniorityDistribution;
  employmentTypes: string[];
  commonResponsibilities: string[];
  commonQualifications: string[];
  fetchedAt: Date;
  expiresAt: Date;
}

const skillProfileSchema = new Schema<ISkillProfile>(
  {
    name: { type: String, required: true },
    normalizedName: { type: String, required: true },
    category: { type: String, default: "General" },
    frequency: { type: Number, required: true, default: 1 },
    percentage: { type: Number, required: true, default: 0 },
    priority: { type: String, enum: ["must-have", "nice-to-have"], required: true },
  },
  { _id: false }
);

const seniorityDistributionSchema = new Schema<ISeniorityDistribution>(
  {
    junior: { type: Number, default: 0 },
    mid: { type: Number, default: 0 },
    senior: { type: Number, default: 0 },
    lead: { type: Number, default: 0 },
    executive: { type: Number, default: 0 },
    unspecified: { type: Number, default: 0 },
    confidence: {
      type: String,
      enum: ["high", "medium", "low", "insufficient_data"],
      default: "medium",
    },
  },
  { _id: false }
);

const jobIntelligenceProfileSchema = new Schema<IJobIntelligenceProfile>(
  {
    normalizedQueryKey: { type: String, required: true, unique: true, index: true },
    company: { type: String, required: true },
    role: { type: String, required: true },
    location: { type: String, required: true },
    isFallback: { type: Boolean, default: false },
    fallbackReason: { type: String, required: false },
    coverage: {
      type: String,
      enum: ["high", "medium", "low", "none"],
      default: "medium",
    },
    postingsCount: { type: Number, default: 0 },
    analyzedPostingsCount: { type: Number, default: 0 },
    skills: { type: [skillProfileSchema], default: [] },
    seniorityDistribution: { type: seniorityDistributionSchema, required: true },
    employmentTypes: { type: [String], default: [] },
    commonResponsibilities: { type: [String], default: [] },
    commonQualifications: { type: [String], default: [] },
    fetchedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  {
    collection: "job_intelligence_profiles",
  }
);

export const JobIntelligenceProfile = mongoose.model<IJobIntelligenceProfile>(
  "JobIntelligenceProfile",
  jobIntelligenceProfileSchema
);
