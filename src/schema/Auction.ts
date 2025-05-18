import mongoose, { Schema, Types, Document } from "mongoose";

interface IAuction extends Document {
  balance: number;
  team: string | null;
}

const AuctionSchema = new Schema<IAuction>({
  balance: { type: Number, default: 0 },
  team: { type: String, default: null },
});

export const Auction = mongoose.model<IAuction>('Auction',AuctionSchema)