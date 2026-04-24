import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IJob extends Document {
  title: string;
  description: string;
  requiredSkills: string[];
  experienceLevel: 'junior' | 'mid' | 'senior';
  educationRequired?: string;
  location?: string;
  employmentType: 'full-time' | 'part-time' | 'contract';
  shortlistLimit: number;
  isActive: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const JobSchema = new Schema<IJob>(
  {
    title:             { type: String, required: true },
    description:       { type: String, required: true },
    requiredSkills:    [String],
    experienceLevel:   { type: String, enum: ['junior', 'mid', 'senior'], default: 'mid' },
    educationRequired: String,
    location:          String,
    employmentType:    { type: String, enum: ['full-time', 'part-time', 'contract'], default: 'full-time' },
    shortlistLimit:    { type: Number, default: 10 },
    isActive:          { type: Boolean, default: true },
    createdBy:         { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export default mongoose.model<IJob>('Job', JobSchema);
