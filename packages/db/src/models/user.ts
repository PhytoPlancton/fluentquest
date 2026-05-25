import mongoose, { type HydratedDocument, type Model, Schema } from 'mongoose';
import { CEFR_LEVELS, type CEFRLevel } from '../types.js';

export interface UserLevels {
  en?: CEFRLevel;
  es?: CEFRLevel;
  fr?: CEFRLevel;
}

export interface UserAttrs {
  email: string;
  passwordHash: string;
  displayName: string;
  level: UserLevels;
  emailVerifiedAt?: Date | null;
  lastLoginAt?: Date | null;
}

export interface UserDoc extends UserAttrs {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDoc>(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true,
      index: true,
    },
    // select:false → never returned by default. Login flow must opt-in with .select('+passwordHash').
    passwordHash: { type: String, required: true, select: false },
    displayName: { type: String, required: true, trim: true, maxlength: 64 },
    level: {
      en: { type: String, enum: CEFR_LEVELS },
      es: { type: String, enum: CEFR_LEVELS },
      fr: { type: String, enum: CEFR_LEVELS },
    },
    emailVerifiedAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export type UserHydrated = HydratedDocument<UserDoc>;
export type UserModel = Model<UserDoc>;

export const User: UserModel =
  (mongoose.models.User as UserModel | undefined) ??
  mongoose.model<UserDoc>('User', userSchema);
