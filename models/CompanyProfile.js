const mongoose = require("mongoose");


const companyProfileSchema = new mongoose.Schema(
  {
    symbol: { type: String, required: true, unique: true, index: true },

    
    tickerId: String, 
    name: String, 
    logoUrl: String, 
    industry: String,

    priceNSE: Number, 
    priceBSE: Number, 
    percentChange: Number,
    high52w: Number, 
    low52w: Number, 

    companyProfile: mongoose.Schema.Types.Mixed,
    stockTechnicalData: mongoose.Schema.Types.Mixed,
    financials: mongoose.Schema.Types.Mixed,
    keyMetrics: mongoose.Schema.Types.Mixed,
    futureExpiryDates: mongoose.Schema.Types.Mixed,
    futureOverviewData: mongoose.Schema.Types.Mixed,
    initialStockFinancialData: mongoose.Schema.Types.Mixed,
    analystView: mongoose.Schema.Types.Mixed,
    recosBar: mongoose.Schema.Types.Mixed,
    riskMeter: mongoose.Schema.Types.Mixed,
    shareholding: mongoose.Schema.Types.Mixed,
    corporateActions: mongoose.Schema.Types.Mixed, 
    stockDetailsReusableData: mongoose.Schema.Types.Mixed,
    recentNews: [mongoose.Schema.Types.Mixed],


    sector: String,
    about: String,
    marketCap: Number,
    peRatio: Number,
    dividendYield: Number,
    beta: Number,
    bookValue: Number,

    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

module.exports = mongoose.model("CompanyProfile", companyProfileSchema);