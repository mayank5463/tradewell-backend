const { WatchlistModel } = require("../models/WatchlistModel");


async function getOrCreateWatchlist(userId) {
  let doc = await WatchlistModel.findOne({ userId });
  if (doc) return doc;

  try {
    doc = await WatchlistModel.create({
      userId,
      lists: [{ name: "Watchlist 1", symbols: [] }],
    });
    doc.activeListId = doc.lists[0]._id;
    await doc.save();
    return doc;
  } catch (err) {
    if (err.code === 11000) return WatchlistModel.findOne({ userId });
    throw err;
  }
}

function serialize(doc) {
  return {
    lists: doc.lists.map((l) => ({ id: l._id, name: l.name, symbols: l.symbols })),
    activeListId: doc.activeListId,
  };
}

async function getWatchlist(userId) {
  const doc = await getOrCreateWatchlist(userId);
  return serialize(doc);
}

async function createList(userId, name) {
  const doc = await getOrCreateWatchlist(userId);
  doc.lists.push({ name: name?.trim() || `Watchlist ${doc.lists.length + 1}`, symbols: [] });
  await doc.save();
  return serialize(doc);
}

async function renameList(userId, listId, name) {
  const doc = await getOrCreateWatchlist(userId);
  const list = doc.lists.id(listId);
  if (!list) throw Object.assign(new Error("List not found."), { statusCode: 404 });
  list.name = name?.trim() || list.name;
  await doc.save();
  return serialize(doc);
}

async function deleteList(userId, listId) {
  const doc = await getOrCreateWatchlist(userId);
  if (doc.lists.length <= 1) {
    throw Object.assign(new Error("You must keep at least one watchlist."), { statusCode: 400 });
  }
  doc.lists.pull({ _id: listId });
  if (String(doc.activeListId) === String(listId)) {
    doc.activeListId = doc.lists[0]._id;
  }
  await doc.save();
  return serialize(doc);
}

async function setActiveList(userId, listId) {
  const doc = await getOrCreateWatchlist(userId);
  const list = doc.lists.id(listId);
  if (!list) throw Object.assign(new Error("List not found."), { statusCode: 404 });
  doc.activeListId = list._id;
  await doc.save();
  return serialize(doc);
}

async function addStockToList(userId, listId, symbol) {
  const doc = await getOrCreateWatchlist(userId);
  const list = doc.lists.id(listId);
  if (!list) throw Object.assign(new Error("List not found."), { statusCode: 404 });
  const upper = symbol.toUpperCase();
  if (!list.symbols.includes(upper)) list.symbols.push(upper);
  await doc.save();
  return serialize(doc);
}

async function removeStockFromList(userId, listId, symbol) {
  const doc = await getOrCreateWatchlist(userId);
  const list = doc.lists.id(listId);
  if (!list) throw Object.assign(new Error("List not found."), { statusCode: 404 });
  list.symbols = list.symbols.filter((s) => s !== symbol.toUpperCase());
  await doc.save();
  return serialize(doc);
}

module.exports = {
  getWatchlist,
  createList,
  renameList,
  deleteList,
  setActiveList,
  addStockToList,
  removeStockFromList,
};