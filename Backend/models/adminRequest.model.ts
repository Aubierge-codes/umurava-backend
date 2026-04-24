import mongoose, { Document, Schema } from 'mongoose';

export type AdminRequestStatus = 'pending' | 'approved' | 'rejected';

export interface IAdminRequest extends Document {
  userId: mongoose.Types.ObjectId;
  reason: string;
  status: AdminRequestStatus;
  reviewedBy?: mongoose.Types.ObjectId | null;
  reviewedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const adminRequestSchema = new Schema<IAdminRequest>(
  {
    userId:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reason:     { type: String, required: true, trim: true, minlength: 10, maxlength: 1000 },
    status:     { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

adminRequestSchema.index({ userId: 1, status: 1 });

export default mongoose.model<IAdminRequest>('AdminRequest', adminRequestSchema);