const { Schema, model } = require("mongoose");


const TransactionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: {
      type: String,
      enum: ["BUY", "SELL", "DEPOSIT", "WITHDRAW"],
      required: true,
    },
    amount: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", default: null },
    symbol: { type: String, default: null },
    note: { type: String, default: null },
  },
  { timestamps: true },
);

TransactionSchema.index({ userId: 1, createdAt: -1 });

const TransactionModel = model("Transaction", TransactionSchema);

module.exports = { TransactionModel };