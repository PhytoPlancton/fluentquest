import mongoose, { type HydratedDocument, type Model, Schema } from 'mongoose';
import { decryptField, encryptField } from '../crypto.js';
import { type ExerciseType } from '../types.js';

export interface ExerciseAttrs {
  userId: mongoose.Types.ObjectId;
  fauteId: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  type: ExerciseType;
  prompt: string;
  options?: string[];
  correctAnswer: string;
  userAnswer?: string | null;
  isCorrect?: boolean | null;
  answeredAt?: Date | null;
  generatedByModel: string;
}

export interface ExerciseDoc extends ExerciseAttrs {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const exerciseSchema = new Schema<ExerciseDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    fauteId: { type: Schema.Types.ObjectId, ref: 'Faute', required: true, index: true },
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
    },
    type: {
      type: String,
      enum: ['mcq', 'rewrite', 'fill_blank'],
      required: true,
    },
    prompt: {
      type: String,
      required: true,
      set: encryptField,
      get: decryptField,
    },
    options: { type: [String], default: undefined },
    correctAnswer: {
      type: String,
      required: true,
      set: encryptField,
      get: decryptField,
    },
    userAnswer: {
      type: String,
      default: null,
      set: encryptField,
      get: decryptField,
    },
    isCorrect: { type: Boolean, default: null },
    answeredAt: { type: Date, default: null, index: true },
    generatedByModel: { type: String, required: true },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { getters: true },
    toObject: { getters: true },
  },
);

exerciseSchema.index({ userId: 1, answeredAt: 1 });

export type ExerciseHydrated = HydratedDocument<ExerciseDoc>;
export type ExerciseModel = Model<ExerciseDoc>;

export const Exercise: ExerciseModel =
  (mongoose.models.Exercise as ExerciseModel | undefined) ??
  mongoose.model<ExerciseDoc>('Exercise', exerciseSchema);
