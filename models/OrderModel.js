
const { Schema, model } = require("mongoose");

const OrderSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    symbol: { type: String, required: true, index: true },
    name: { type: String, default: null },
    logoUrl: { type: String, default: null },
    instrumentToken: { type: String, default: null },

    qty: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true },

    mode: {
      type: String,
      enum: ["BUY", "SELL"],
      required: true,
    },

    product: {
      type: String,
      enum: ["CNC", "MIS"],
      default: "CNC",
    },

    orderType: {
      type: String,
      enum: ["MARKET", "LIMIT"],
      default: "MARKET",
    },

    status: {
      type: String,
      enum: ["PENDING", "COMPLETE", "REJECTED", "CANCELLED"],
      default: "COMPLETE",
    },

    dayChangePercentAtOrder: { type: Number, default: null },


    realizedPnl: { type: Number, default: null },

    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

OrderSchema.index({ userId: 1, symbol: 1, timestamp: -1 });

const OrderModel = model("Order", OrderSchema);

module.exports = { OrderSchema, OrderModel };