import mongoose, { Schema, Document } from "mongoose";

export interface IJobPostingRaw extends Document {
  query: string;
  company: string;
  role: string;
  location: string;
  isFallback: boolean;
  searchParameters: Record<string, any>;
  rawResponse: Record<string, any>;
  postingsCount: number;
  createdAt: Date;
}

const jobPostingRawSchema = new Schema<IJobPostingRaw>(
  {
    query: { type: String, required: true, index: true },
    company: { type: String, required: true },
    role: { type: String, required: true },
    location: { type: String, required: true },
    isFallback: { type: Boolean, default: false },
    searchParameters: { type: Schema.Types.Mixed, default: {} },
    rawResponse: { type: Schema.Types.Mixed, required: true },
    postingsCount: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
  },
  {
    collection: "job_postings_raw",
  }
);

export const JobPostingRaw = mongoose.model<IJobPostingRaw>(
  "JobPostingRaw",
  jobPostingRawSchema
);
