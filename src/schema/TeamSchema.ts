// src/models/Team.ts
import mongoose, { Schema, Document } from "mongoose";

export interface ITeam extends Document {
  name: string;
  captain: string;
  gender: "male" | "female";
  hasStar: boolean;
  captainImage: string;
  email: string;
  type: "admin" | "team";
  balance: number;
}

const TeamSchema = new Schema<ITeam>({
  name: { type: String, required: true },
  gender: { type: String, enum: ["male", "female"], required: true },
  balance: { type: Number, default: 5000 },
  captain: { type: String, required: true },
  email: { type: String, required: true },
  type: { type: String, enum: ["admin", "team"], default: "team" },
  captainImage: { type: String, required: true },
});

export const Team = mongoose.model<ITeam>("Team", TeamSchema);
