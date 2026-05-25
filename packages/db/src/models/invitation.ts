import mongoose, { type HydratedDocument, type Model, Schema } from 'mongoose';
import { type InvitationStatus, ROLES, type Role } from '../types.js';

export interface InvitationAttrs {
  workspaceId: mongoose.Types.ObjectId;
  email: string;
  invitedByUserId: mongoose.Types.ObjectId;
  role: Exclude<Role, 'owner'>;
  token: string;
  status: InvitationStatus;
  expiresAt: Date;
  acceptedAt?: Date | null;
}

export interface InvitationDoc extends InvitationAttrs {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const invitationSchema = new Schema<InvitationDoc>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    invitedByUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: {
      type: String,
      enum: ROLES.filter((r) => r !== 'owner'),
      required: true,
      default: 'member',
    },
    token: { type: String, required: true, unique: true, index: true },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'expired', 'revoked'],
      required: true,
      default: 'pending',
      index: true,
    },
    expiresAt: { type: Date, required: true },
    acceptedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

invitationSchema.index({ workspaceId: 1, email: 1, status: 1 });

export type InvitationHydrated = HydratedDocument<InvitationDoc>;
export type InvitationModel = Model<InvitationDoc>;

export const Invitation: InvitationModel =
  (mongoose.models.Invitation as InvitationModel | undefined) ??
  mongoose.model<InvitationDoc>('Invitation', invitationSchema);
