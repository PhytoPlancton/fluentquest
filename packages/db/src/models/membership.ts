import mongoose, { type HydratedDocument, type Model, Schema } from 'mongoose';
import { ROLES, type Role } from '../types.js';

export interface MembershipAttrs {
  userId: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  role: Role;
  joinedAt: Date;
}

export interface MembershipDoc extends MembershipAttrs {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const membershipSchema = new Schema<MembershipDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    role: { type: String, enum: ROLES, required: true, default: 'member' },
    joinedAt: { type: Date, default: () => new Date() },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

membershipSchema.index({ userId: 1, workspaceId: 1 }, { unique: true });

export type MembershipHydrated = HydratedDocument<MembershipDoc>;
export type MembershipModel = Model<MembershipDoc>;

export const Membership: MembershipModel =
  (mongoose.models.Membership as MembershipModel | undefined) ??
  mongoose.model<MembershipDoc>('Membership', membershipSchema);
