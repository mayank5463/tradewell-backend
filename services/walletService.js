const mongoose = require("mongoose");
const { WalletModel } = require("../models/WalletModel");
const { TransactionModel } = require("../models/TransactionModel");
const { HoldingModel } = require("../models/HoldingModel");
const { PositionModel } = require("../models/PositionModel");
const { OrderModel } = require("../models/OrderModel");

const STARTING_BALANCE = 500000;

class InsufficientFundsError extends Error {
  constructor(message) {
    super(message);
    this.name = "InsufficientFundsError";
    this.statusCode = 400;
  }
}

async function getOrCreateWallet(userId, session = null) {
  let wallet = await WalletModel.findOne({ userId }).session(session);
  if (wallet) return wallet;

  try {
    const created = await WalletModel.create([{ userId, balance: STARTING_BALANCE }], { session });
    wallet = created[0];
    await TransactionModel.create(
      [{ userId, type: "DEPOSIT", amount: STARTING_BALANCE, balanceAfter: STARTING_BALANCE, note: "Initial paper trading balance" }],
      { session },
    );
    console.log(`[WALLET] ✅ Created wallet for user ${userId} with ₹${STARTING_BALANCE}`);
    return wallet;
  } catch (err) {
    if (err.code === 11000) return WalletModel.findOne({ userId }).session(session);
    throw err;
  }
}

async function getWallet(userId) {
  return getOrCreateWallet(userId);
}

async function debit({ userId, amount, orderId = null, symbol = null, note = null, type = "BUY", session = null }) {
  if (!(amount > 0)) throw new Error("Debit amount must be a positive number.");

  await getOrCreateWallet(userId, session);

  const wallet = await WalletModel.findOneAndUpdate(
    { userId, balance: { $gte: amount } },
    { $inc: { balance: -amount } },
    { new: true, session },
  );

  if (!wallet) throw new InsufficientFundsError("Insufficient funds for this order.");

  await TransactionModel.create([{ userId, type, amount, balanceAfter: wallet.balance, orderId, symbol, note }], { session });

  return wallet;
}

async function credit({ userId, amount, orderId = null, symbol = null, note = null, type = "SELL", session = null }) {
  if (!(amount > 0)) throw new Error("Credit amount must be a positive number.");

  await getOrCreateWallet(userId, session);

  const wallet = await WalletModel.findOneAndUpdate(
    { userId },
    { $inc: { balance: amount } },
    { new: true, session },
  );

  await TransactionModel.create([{ userId, type, amount, balanceAfter: wallet.balance, orderId, symbol, note }], { session });

  return wallet;
}

async function getLedger(userId, { limit = 50, before } = {}) {
  const filter = { userId };
  if (before) filter.createdAt = { $lt: new Date(before) };
  return TransactionModel.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
}

async function resetPaperTradingAccount(userId) {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    await HoldingModel.deleteMany({ userId }).session(session);
    await PositionModel.deleteMany({ userId }).session(session);
    await OrderModel.deleteMany({ userId }).session(session);
    await TransactionModel.deleteMany({ userId }).session(session);

    const wallet = await WalletModel.findOneAndUpdate(
      { userId },
      { balance: STARTING_BALANCE, marginUsed: 0 },
      { new: true, upsert: true, session },
    );

    await TransactionModel.create(
      [{ userId, type: "DEPOSIT", amount: STARTING_BALANCE, balanceAfter: STARTING_BALANCE, note: "Account reset" }],
      { session },
    );

    await session.commitTransaction();
    console.log(`[WALLET] ✅ Reset account for user ${userId} — balance restored to ₹${STARTING_BALANCE}`);
    return wallet;
  } catch (err) {
    await session.abortTransaction();
    console.error(`[WALLET] ❌ Reset failed for user ${userId}:`, err.message);
    throw err;
  } finally {
    session.endSession();
  }
}

module.exports = {
  STARTING_BALANCE,
  InsufficientFundsError,
  getOrCreateWallet,
  getWallet,
  debit,
  credit,
  getLedger,
  resetPaperTradingAccount,
};