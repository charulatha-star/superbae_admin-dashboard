import mongoose, { Schema, Document } from 'mongoose';

export interface IClub extends Document {
  id: string;
  name: string;
  description?: string;
  members: string[];
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}

const ClubSchema = new Schema<IClub>(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    description: { type: String },
    members: [{ type: String }],
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { strict: false, versionKey: false, id: false }
);

export default mongoose.model<IClub>('Club', ClubSchema);
