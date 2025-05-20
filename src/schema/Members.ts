import mongoose, { Schema, Document, Types } from "mongoose";
import { ITeam } from "./TeamSchema";

export interface IMember extends Document {
  name: string;
  image: string;
  price: null | string;
  isSold: boolean;
  soldTo: Types.ObjectId | ITeam | null;
  isStar: boolean;
  position: "goalkeeper" | "striker" | "midfielder" | "defender";
  number: number;
  gender: "male" | "female";
}

const MaleMemberSchema = new Schema<IMember>({
  name: { type: String, required: true },
  image: { type: String, required: true },
  price: { type: Number, default: null },
  number: { type: Number, required: true },
  isSold: { type: Boolean, default: false },
  soldTo: { type: Schema.Types.ObjectId, ref: "Team", default: null },
  isStar: { type: Boolean, default: false },
  position: {
    type: String,
    enum: ["goalkeeper", "striker", "midfielder", "defender"],
    required: true,
  },
  gender: { type: String, default: "male" },
});

const FemaleMemberSchema = new Schema<IMember>({
  name: { type: String, required: true },
  image: { type: String, required: true },
  price: { type: Number, default: null },
  number: { type: Number, required: true },
  isSold: { type: Boolean, default: false },
  soldTo: { type: Schema.Types.ObjectId, ref: "Team", default: null },
  isStar: { type: Boolean, default: false },
  position: {
    type: String,
    enum: ["goalkeeper", "striker", "midfielder", "defender"],
    required: true,
  },
  gender: { type: String, default: "female" },
});

export const Male = mongoose.model<IMember>("Male", MaleMemberSchema);
export const Female = mongoose.model<IMember>("Female", FemaleMemberSchema);
