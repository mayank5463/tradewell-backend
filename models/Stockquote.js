const mongoose = require("mongoose");



const DepthLevelSchema = new mongoose.Schema(
  {
    price: { type: Number, default: 0 },
    quantity: { type: Number, default: 0 },
    orders: { type: Number, default: 0 },
  },
  { _id: false },
);

const StockQuoteSchema = new mongoose.Schema(
  {
    symbol: { type: String, required: true, index: true },
    name: { type: String, default: null }, 

    instrumentToken: { type: String, default: null },

    // Price
    ltp: { type: Number, required: true },
    prevClose: { type: Number, default: null },
    netChange: { type: Number, default: null },
    dayChangePercent: { type: Number, default: 0 },
    averagePrice: { type: Number, default: null },

   
    open: { type: Number, default: null },
    high: { type: Number, default: null },
    low: { type: Number, default: null },
    close: { type: Number, default: null },

    // Volume / interest
    volume: { type: Number, default: null },
    oi: { type: Number, default: null },
    oiDayHigh: { type: Number, default: null },
    oiDayLow: { type: Number, default: null },

    // Order book pressure
    totalBuyQuantity: { type: Number, default: null },
    totalSellQuantity: { type: Number, default: null },

    // Circuit limits
    lowerCircuitLimit: { type: Number, default: null },
    upperCircuitLimit: { type: Number, default: null },

    // Market depth — top 5 bid/ask levels
    depth: {
      buy: { type: [DepthLevelSchema], default: [] },
      sell: { type: [DepthLevelSchema], default: [] },
    },

   
    lastTradeTime: { type: String, default: null },
    exchangeTimestamp: { type: String, default: null },

    
    updatedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, 
  },
);


StockQuoteSchema.index({ symbol: 1, createdAt: -1 });

module.exports = mongoose.model("StockQuote", StockQuoteSchema);