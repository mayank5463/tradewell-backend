const { Schema, model } = require("mongoose");


const WatchlistListSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    symbols: { type: [String], default: [] },
  },
  { _id: true, timestamps: false },
);

const WatchlistSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    lists: { type: [WatchlistListSchema], default: [] },
    activeListId: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true },
);

const WatchlistModel = model("Watchlist", WatchlistSchema);

module.exports = { WatchlistModel };