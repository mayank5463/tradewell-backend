
const mongoose = require("mongoose");

const historicalCandleSchema = new mongoose.Schema(
  {
    symbol: { type: String, required: true, index: true },
    unit: { type: String, required: true }, // "minutes" | "hours" | "days" | "weeks" | "months"
    interval: { type: Number, required: true },
    timestamp: { type: String, required: true }, // Upstox's ISO string, kept as-is
    open: Number,
    high: Number,
    low: Number,
    close: Number,
    volume: Number,
    oi: Number,
  },
  { timestamps: false },
);


historicalCandleSchema.index(
  { symbol: 1, unit: 1, interval: 1, timestamp: 1 },
  { unique: true },
);

module.exports = mongoose.model("HistoricalCandle", historicalCandleSchema);