const { Schema, model } = require("mongoose");

const PositionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    product: {
      type: String,
      enum: ["CNC", "MIS"],
      default: "MIS",
    },

    symbol: { type: String, required: true },
    name: { type: String, default: null },
    logoUrl: { type: String, default: null },
    instrumentToken: { type: String, default: null },

    qty: { type: Number, required: true, default: 0 },
    avgPrice: { type: Number, required: true },

    ltp: { type: Number, default: null },

    netChangePercent: { type: Number, default: 0 },
    dayChangePercent: { type: Number, default: 0 },

    isLoss: { type: Boolean, default: false },
  },
  { timestamps: true },
);

PositionSchema.index({ userId: 1, symbol: 1 }, { unique: true });

const PositionModel = model("Position", PositionSchema);

module.exports = { PositionSchema, PositionModel };
