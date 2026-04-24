import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  authProvider: 'local' | 'google';
  googleId?: string | null;
  role: 'admin' | 'applicant';
  isVerified: boolean;
  verificationCode?: string | null;
  verificationCodeExpires?: Date | null;
  companyName: string;
  resetPasswordCode?: string | null;
  resetPasswordExpires?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name:     { type: String, required: true },
    email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
    googleId: { type: String, unique: true, sparse: true },
    role:     { type: String, enum: ['admin', 'applicant'], default: 'applicant' },

    isVerified:              { type: Boolean, default: false },
    verificationCode:        { type: String },
    verificationCodeExpires: { type: Date },
    companyName:             { type: String, default: '' },
    resetPasswordCode:       { type: String },
    resetPasswordExpires:    { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model<IUser>('User', userSchema);
