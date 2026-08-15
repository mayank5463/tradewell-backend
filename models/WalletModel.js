const { Schema, model } = require("mongoose");


const WalletSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, 
      index: true,
    },

    balance: {
      type: Number,
      required: true,
      default: 500000,
      min: 0, 
    },

    currency: { type: String, default: "INR" },

 
    marginUsed: { type: Number, default: 0 },
  },
  { timestamps: true },
);

const WalletModel = model("Wallet", WalletSchema);

module.exports = { WalletModel };