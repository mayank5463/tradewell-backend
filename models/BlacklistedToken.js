const { Schema, model } = require("mongoose");

// ══════════════════════════════════════════════════════════════════════
// BLACKLISTED TOKEN - Persisted replacement for the old in-memory
// `tokenBlacklist` Set in authController.js.
//
// WHY THIS MATTERS: a JWT is valid for 7 days (see issueAuthCookie.js).
// When a user logs out, the cookie is cleared client-side, but the JWT
// itself is still cryptographically valid until it naturally expires —
// so it gets added to a blacklist so checkAuth() can reject it if it's
// ever replayed. The old in-memory Set meant every Render restart
// silently un-blacklisted every logged-out token instantly. This
// version survives restarts and self-cleans via the TTL index, so a
// blacklist entry disappears right around when the JWT would have
// expired anyway — no need to track expiry separately.
// ══════════════════════════════════════════════════════════════════════

const BlacklistedTokenSchema = new Schema({
  token: {
    type: String,
    required: true,
    unique: true,
  },
  // Matches the JWT's own 7-day lifetime (see issueAuthCookie.js
  // `expiresIn: "7d"`). Once this passes, the token would fail
  // jwt.verify() anyway, so there's no reason to keep the blacklist
  // entry around after this point.
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 },
  },
});

const BlacklistedTokenModel = model("BlacklistedToken", BlacklistedTokenSchema);

module.exports = { BlacklistedTokenModel };