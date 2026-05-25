import mongoose, { type HydratedDocument, type Model, Schema } from 'mongoose';

export interface WorkspaceAttrs {
  name: string;
  slug: string;
  ownerUserId: mongoose.Types.ObjectId;
  isPersonal: boolean;
}

export interface WorkspaceDoc extends WorkspaceAttrs {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const workspaceSchema = new Schema<WorkspaceDoc>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true,
      index: true,
      match: /^[a-z0-9-]+$/,
    },
    ownerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    isPersonal: { type: Boolean, required: true, default: false },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export type WorkspaceHydrated = HydratedDocument<WorkspaceDoc>;
export type WorkspaceModel = Model<WorkspaceDoc>;

export const Workspace: WorkspaceModel =
  (mongoose.models.Workspace as WorkspaceModel | undefined) ??
  mongoose.model<WorkspaceDoc>('Workspace', workspaceSchema);
