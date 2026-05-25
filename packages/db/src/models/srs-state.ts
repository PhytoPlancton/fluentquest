import mongoose, { type HydratedDocument, type Model, Schema } from 'mongoose';

export interface SRSStateAttrs {
  userId: mongoose.Types.ObjectId;
  fauteId: mongoose.Types.ObjectId;
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  lapses: number;
  nextReviewAt: Date;
  lastReviewedAt?: Date | null;
}

export interface SRSStateDoc extends SRSStateAttrs {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const srsStateSchema = new Schema<SRSStateDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    fauteId: {
      type: Schema.Types.ObjectId,
      ref: 'Faute',
      required: true,
      index: true,
    },
    easeFactor: { type: Number, default: 2.5, min: 1.3 },
    intervalDays: { type: Number, default: 0, min: 0 },
    repetitions: { type: Number, default: 0, min: 0 },
    lapses: { type: Number, default: 0, min: 0 },
    nextReviewAt: { type: Date, required: true, index: true },
    lastReviewedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

srsStateSchema.index({ userId: 1, fauteId: 1 }, { unique: true });
srsStateSchema.index({ userId: 1, nextReviewAt: 1 });

export type SRSStateHydrated = HydratedDocument<SRSStateDoc>;
export type SRSStateModel = Model<SRSStateDoc>;

export const SRSState: SRSStateModel =
  (mongoose.models.SRSState as SRSStateModel | undefined) ??
  mongoose.model<SRSStateDoc>('SRSState', srsStateSchema);
