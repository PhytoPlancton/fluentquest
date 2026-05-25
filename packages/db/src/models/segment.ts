import mongoose, { type HydratedDocument, type Model, Schema } from 'mongoose';
import { decryptField, encryptField } from '../crypto.js';
import { LANGUAGES, type Language } from '../types.js';

export interface SegmentAttrs {
  sessionId: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  speakerLabel: string;
  assignedUserId?: mongoose.Types.ObjectId | null;
  startMs: number;
  endMs: number;
  text: string;
  language: Language;
  markedAt?: Date | null;
}

export interface SegmentDoc extends SegmentAttrs {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const segmentSchema = new Schema<SegmentDoc>(
  {
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: 'Session',
      required: true,
      index: true,
    },
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    speakerLabel: { type: String, required: true, maxlength: 16 },
    assignedUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    startMs: { type: Number, required: true, min: 0 },
    endMs: { type: Number, required: true, min: 0 },
    text: {
      type: String,
      required: true,
      set: encryptField,
      get: decryptField,
    },
    language: { type: String, enum: LANGUAGES, required: true },
    markedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { getters: true },
    toObject: { getters: true },
  },
);

segmentSchema.index({ sessionId: 1, startMs: 1 });

export type SegmentHydrated = HydratedDocument<SegmentDoc>;
export type SegmentModel = Model<SegmentDoc>;

export const Segment: SegmentModel =
  (mongoose.models.Segment as SegmentModel | undefined) ??
  mongoose.model<SegmentDoc>('Segment', segmentSchema);
