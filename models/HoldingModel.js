const { Schema, model } = require("mongoose");

const HoldingSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },


    product: {
      type: String,
      enum: ["CNC"],
      default: "CNC",
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

HoldingSchema.index({ userId: 1, symbol: 1 }, { unique: true });

const HoldingModel = model("Holding", HoldingSchema);

module.exports = { HoldingSchema, HoldingModel };