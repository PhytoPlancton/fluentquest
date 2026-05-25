import mongoose, { type HydratedDocument, type Model, Schema } from 'mongoose';
import { decryptField, encryptField } from '../crypto.js';
import {
  type AudioStorage,
  LANGUAGES,
  type Language,
  type SessionStatus,
} from '../types.js';

export interface SessionParticipant {
  userId: mongoose.Types.ObjectId;
  displayName: string;
}

export interface SessionAttrs {
  workspaceId: mongoose.Types.ObjectId;
  recordedByUserId: mongoose.Types.ObjectId;
  title?: string | null;
  startedAt: Date;
  endedAt?: Date | null;
  durationSec: number;
  participants: SessionParticipant[];
  languages: Language[];
  audioStorage: AudioStorage;
  audioUrl?: string | null;
  audioExpiresAt?: Date | null;
  transcriptionStatus: SessionStatus;
  analysisStatus: SessionStatus;
}

export interface SessionDoc extends SessionAttrs {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const participantSchema = new Schema<SessionParticipant>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    displayName: { type: String, required: true },
  },
  { _id: false },
);

const sessionSchema = new Schema<SessionDoc>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    recordedByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: { type: String, default: null, maxlength: 200 },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, default: null },
    durationSec: { type: Number, default: 0, min: 0 },
    participants: { type: [participantSchema], default: [] },
    languages: [{ type: String, enum: LANGUAGES }],
    audioStorage: { type: String, enum: ['local', 's3'], default: 'local' },
    audioUrl: {
      type: String,
      default: null,
      set: encryptField,
      get: decryptField,
    },
    audioExpiresAt: { type: Date, default: null },
    transcriptionStatus: {
      type: String,
      enum: ['pending', 'processing', 'done', 'failed'],
      default: 'pending',
      index: true,
    },
    analysisStatus: {
      type: String,
      enum: ['pending', 'processing', 'done', 'failed'],
      default: 'pending',
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { getters: true },
    toObject: { getters: true },
  },
);

sessionSchema.index({ workspaceId: 1, startedAt: -1 });

export type SessionHydrated = HydratedDocument<SessionDoc>;
export type SessionModel = Model<SessionDoc>;

export const Session: SessionModel =
  (mongoose.models.Session as SessionModel | undefined) ??
  mongoose.model<SessionDoc>('Session', sessionSchema);
