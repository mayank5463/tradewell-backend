const mongoose = require("mongoose");
const { OrderModel } = require("../models/OrderModel");
const { HoldingModel } = require("../models/HoldingModel");
const { PositionModel } = require("../models/PositionModel");
const { getLiveQuote } = require("../services/marketQuoteService");
const {
  debit,
  credit,
  InsufficientFundsError,
} = require("../services/walletService");

async function getAllOrders(req, res) {
  try {
    const data = await OrderModel.find({ userId: req.user.id }).sort({
      timestamp: -1,
    });
    return res.json(data);
  } catch (err) {
    console.error("[ORDERS] ❌ Error:", err.message);
    return res.status(500).json({ error: "Failed to fetch orders." });
  }
}

async function withRetryableTransaction(fn, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      const result = await fn(session);
      await session.commitTransaction();
      return result;
    } catch (err) {
      await session.abortTransaction();
      const transient = err.errorLabels?.includes("TransientTransactionError");
      if (!transient || i === attempts - 1) throw err;
    } finally {
      session.endSession();
    }
  }
}

async function newOrder(req, res) {
  const { qty, price, mode, product } = req.body;
  const symbol = req.body.symbol || req.body.name;
  const userId = req.user.id;
  const productType = product === "MIS" ? "MIS" : "CNC";
  // ADDED — routes to HoldingModel for CNC, PositionModel for MIS. This is
  // what tradeActions.js's `product: productType` field on the frontend
  // now actually controls; previously this field was accepted but ignored,
  // so every order landed in Holdings regardless of what the user picked.
  const TargetModel = productType === "MIS" ? PositionModel : HoldingModel;

  if (!symbol || !qty || !price || !mode) {
    return res
      .status(400)
      .json({ error: "Missing required fields.", received: req.body });
  }

  const numQty = Number(qty);
  const numPrice = Number(price);

  if (isNaN(numQty) || isNaN(numPrice) || numQty <= 0 || numPrice <= 0) {
    return res
      .status(400)
      .json({ error: "Qty and price must be positive numbers." });
  }
  if (!Number.isInteger(numQty)) {
    return res.status(400).json({ error: "Qty must be a whole number." });
  }
  if (!["BUY", "SELL"].includes(mode)) {
    return res.status(400).json({ error: "Mode must be BUY or SELL." });
  }

  const liveQuote = getLiveQuote(symbol);
  const orderValue = Number((numQty * numPrice).toFixed(2));

  // ADDED — realizedPnl is computed inside the SELL branch below (it needs
  // updatedDoc.avgPrice, which only exists once the position lookup runs
  // inside the transaction). Declared here so it's in scope when the order
  // document is created further down, and stays null for BUY orders since
  // a buy never realizes P&L.
  let realizedPnl = null;

  try {
    await withRetryableTransaction(async (session) => {
      if (mode === "BUY") {
        try {
          await debit({
            userId,
            amount: orderValue,
            symbol,
            note: `BUY ${numQty} ${symbol} @ ₹${numPrice}`,
            type: "BUY",
            session,
          });
        } catch (err) {
          if (err instanceof InsufficientFundsError) {
            const e = new Error("Insufficient funds for this order.");
            e.statusCode = 400;
            throw e;
          }
          throw err;
        }

        const existing = await TargetModel.findOne({ userId, symbol }).session(
          session,
        );
        if (existing) {
          const totalQty = existing.qty + numQty;
          const avgPrice =
            (existing.avgPrice * existing.qty + numPrice * numQty) / totalQty;
          await TargetModel.updateOne(
            { userId, symbol },
            {
              qty: totalQty,
              avgPrice: parseFloat(avgPrice.toFixed(2)),
              ltp: liveQuote?.ltp ?? numPrice,
              name: liveQuote?.name || existing.name,
              logoUrl: liveQuote?.logoUrl || existing.logoUrl,
              instrumentToken:
                liveQuote?.instrumentToken || existing.instrumentToken,
              netChangePercent: Number(
                (((numPrice - avgPrice) / avgPrice) * 100).toFixed(2),
              ),
              dayChangePercent:
                liveQuote?.dayChangePercent ?? existing.dayChangePercent,
              isLoss: (liveQuote?.ltp ?? numPrice) < avgPrice,
              ...(productType === "MIS" ? { product: "MIS" } : {}),
            },
            { session },
          );
        } else {
          await TargetModel.create(
            [
              {
                userId,
                symbol,
                name: liveQuote?.name || symbol,
                logoUrl: liveQuote?.logoUrl ?? null,
                instrumentToken: liveQuote?.instrumentToken || null,
                qty: numQty,
                avgPrice: numPrice,
                ltp: liveQuote?.ltp ?? numPrice,
                netChangePercent: 0,
                dayChangePercent: liveQuote?.dayChangePercent ?? 0,
                isLoss: false,
                ...(productType === "MIS" ? { product: "MIS" } : {}),
              },
            ],
            { session },
          );
        }
      }

      if (mode === "SELL") {
        const updatedDoc = await TargetModel.findOneAndUpdate(
          { userId, symbol, qty: { $gte: numQty } },
          { $inc: { qty: -numQty } },
          { new: true, session },
        );

        if (!updatedDoc) {
          const existing = await TargetModel.findOne({
            userId,
            symbol,
          }).session(session);
          const label = productType === "MIS" ? "positions" : "holdings";
          const e = new Error(
            existing
              ? `You only have ${existing.qty} shares of ${symbol} in ${label}.`
              : `You don't hold any shares of ${symbol} in ${label}.`,
          );
          e.statusCode = 400;
          throw e;
        }

        // ADDED — this is the actual booked profit/loss for THIS sell.
        // updatedDoc.avgPrice is untouched by the $inc above (only qty
        // changed), so it's still the average buy price the position was
        // carrying the instant before this sell — exactly the reference
        // point realized P&L needs. Computed here, before the qty===0
        // delete branch below, so it's captured regardless of whether the
        // position closes out completely or partially.
        realizedPnl = Number(
          ((numPrice - updatedDoc.avgPrice) * numQty).toFixed(2),
        );

        if (updatedDoc.qty === 0) {
          await TargetModel.deleteOne({ userId, symbol }).session(session);
        } else {
          const netChangePercent = Number(
            (
              ((numPrice - updatedDoc.avgPrice) / updatedDoc.avgPrice) *
              100
            ).toFixed(2),
          );
          await TargetModel.updateOne(
            { userId, symbol },
            {
              ltp: liveQuote?.ltp ?? numPrice,
              logoUrl: liveQuote?.logoUrl || updatedDoc.logoUrl,
              netChangePercent,
              dayChangePercent:
                liveQuote?.dayChangePercent ?? updatedDoc.dayChangePercent,
              isLoss: (liveQuote?.ltp ?? numPrice) < updatedDoc.avgPrice,
            },
            { session },
          );
        }
      }

      const [order] = await OrderModel.create(
        [
          {
            userId,
            symbol,
            name: liveQuote?.name || symbol,
            logoUrl: liveQuote?.logoUrl ?? null,
            instrumentToken: liveQuote?.instrumentToken || null,
            qty: numQty,
            price: numPrice,
            mode,
            product: productType,
            dayChangePercentAtOrder: liveQuote?.dayChangePercent ?? null,
            // ADDED — null for BUY orders, computed value for SELL orders.
            realizedPnl,
          },
        ],
        { session },
      );

      if (mode === "SELL") {
        await credit({
          userId,
          amount: orderValue,
          orderId: order._id,
          symbol,
          note: `SELL ${numQty} ${symbol} @ ₹${numPrice}`,
          type: "SELL",
          session,
        });
      }
    });

    return res.json({ message: `${mode} order placed successfully!` });
  } catch (err) {
    console.error("[NEW ORDER] ❌ Error:", err.message);
    return res
      .status(err.statusCode || 500)
      .json({
        error: err.statusCode ? err.message : "Failed to process order.",
      });
  }
}

module.exports = { getAllOrders, newOrder };
