import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IApplication extends Document {
  userId: Types.ObjectId | null;
  name: string;
  email: string;
  jobId: Types.ObjectId;
  files: string[];
  fileHash: string;
  resumeText?: string;
  score: number | null;
  rank: number | null;
  strengths: string[];
  gaps: string[];
  recommendation: 'Shortlist' | 'Consider' | 'Reject' | null;
  summary?: string;
  shortlisted: boolean;
  screeningStatus: 'pending' | 'processing' | 'done' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

const ApplicationSchema = new Schema<IApplication>(
  {
    userId:   { type: Schema.Types.ObjectId, ref: 'User', default: null },
    name:     { type: String, required: true },
    email:    { type: String, required: true },
    jobId:    { type: Schema.Types.ObjectId, ref: 'Job', required: true },

    files:    [String],
    fileHash: { type: String, required: true },

    resumeText: String,

    score:          { type: Number, default: null },
    rank:           { type: Number, default: null },
    strengths:      [String],
    gaps:           [String],
    recommendation: { type: String, enum: ['Shortlist', 'Consider', 'Reject'], default: null },
    summary:        String,
    shortlisted:    { type: Boolean, default: false },

    screeningStatus: {
      type: String,
      enum: ['pending', 'processing', 'done', 'failed'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

ApplicationSchema.index({ jobId: 1, fileHash: 1 }, { unique: true });

export default mongoose.model<IApplication>('Application', ApplicationSchema);
