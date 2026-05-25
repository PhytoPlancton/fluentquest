import mongoose, { type HydratedDocument, type Model, Schema } from 'mongoose';

export interface AuthSessionAttrs {
  token: string;
  userId: mongoose.Types.ObjectId;
  expiresAt: Date;
  lastSeenAt: Date;
  userAgent?: string | null;
  ipAddress?: string | null;
}

export interface AuthSessionDoc extends AuthSessionAttrs {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const authSessionSchema = new Schema<AuthSessionDoc>(
  {
    token: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // index défini via authSessionSchema.index() ci-dessous (TTL)
    expiresAt: { type: Date, required: true },
    lastSeenAt: { type: Date, default: () => new Date() },
    userAgent: { type: String, default: null, maxlength: 512 },
    ipAddress: { type: String, default: null, maxlength: 64 },
  },
  { timestamps: true, versionKey: false },
);

// TTL index : Mongo supprime auto les sessions expirées
authSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type AuthSessionHydrated = HydratedDocument<AuthSessionDoc>;
export type AuthSessionModel = Model<AuthSessionDoc>;

export const AuthSession: AuthSessionModel =
  (mongoose.models.AuthSession as AuthSessionModel | undefined) ??
  mongoose.model<AuthSessionDoc>('AuthSession', authSessionSchema);
