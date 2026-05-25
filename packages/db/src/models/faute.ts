import mongoose, { type HydratedDocument, type Model, Schema } from 'mongoose';
import { decryptField, encryptField } from '../crypto.js';
import {
  type FauteCategory,
  LANGUAGES,
  type Language,
  type Severity,
} from '../types.js';

export interface HighlightSpan {
  startChar: number;
  endChar: number;
}

export interface FauteAttrs {
  segmentId: mongoose.Types.ObjectId;
  sessionId: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  category: FauteCategory;
  language: Language;
  severity: Severity;
  originalText: string;
  correctedText: string;
  highlightSpan: HighlightSpan;
  ruleSummary: string;
  ruleDeep?: string | null;
  examples: string[];
  isInteresting: boolean;
  generatedByModel: string;
}

export interface FauteDoc extends FauteAttrs {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const highlightSpanSchema = new Schema<HighlightSpan>(
  {
    startChar: { type: Number, required: true, min: 0 },
    endChar: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const fauteSchema = new Schema<FauteDoc>(
  {
    segmentId: { type: Schema.Types.ObjectId, ref: 'Segment', required: true, index: true },
    sessionId: { type: Schema.Types.ObjectId, ref: 'Session', required: true, index: true },
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    category: {
      type: String,
      enum: ['grammar', 'vocab', 'idiom', 'collocation', 'pronunciation', 'style'],
      required: true,
      index: true,
    },
    language: { type: String, enum: LANGUAGES, required: true },
    severity: { type: Number, enum: [1, 2, 3, 4, 5], required: true, index: true },
    originalText: {
      type: String,
      required: true,
      set: encryptField,
      get: decryptField,
    },
    correctedText: {
      type: String,
      required: true,
      set: encryptField,
      get: decryptField,
    },
    highlightSpan: { type: highlightSpanSchema, required: true },
    ruleSummary: { type: String, required: true, maxlength: 500 },
    ruleDeep: { type: String, default: null },
    examples: { type: [String], default: [] },
    isInteresting: { type: Boolean, default: false },
    generatedByModel: { type: String, required: true },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { getters: true },
    toObject: { getters: true },
  },
);

fauteSchema.index({ userId: 1, createdAt: -1 });

export type FauteHydrated = HydratedDocument<FauteDoc>;
export type FauteModel = Model<FauteDoc>;

export const Faute: FauteModel =
  (mongoose.models.Faute as FauteModel | undefined) ??
  mongoose.model<FauteDoc>('Faute', fauteSchema);
