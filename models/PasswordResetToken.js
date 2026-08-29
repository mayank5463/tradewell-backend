const { Schema, model } = require("mongoose");

// ══════════════════════════════════════════════════════════════════════
// PASSWORD RESET TOKEN - Persisted replacement for the old in-memory
// `resetTokens` Map in authController.js.
//
// WHY THIS EXISTS: the old Map lived in server RAM. Every deploy or
// restart (which Render does routinely) wiped it instantly — any reset
// link a user hadn't clicked yet became permanently dead, even though
// the email told them it was valid for 30 minutes. Storing it in Mongo
// survives restarts, and the TTL index below makes Mongo auto-delete
// expired documents for us, so there's no manual cleanup needed.
// ══════════════════════════════════════════════════════════════════════

const PasswordResetTokenSchema = new Schema({
  // We store a SHA-256 hash of the token, never the raw token, exactly
  // like the old in-memory version did — if the DB were ever read by
  // someone unauthorized, they still couldn't use these values directly.
  hashedToken: {
    type: String,
    required: true,
    unique: true,
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  // TTL index: MongoDB's background task automatically deletes a
  // document once this date is in the past. `expires: 0` means "delete
  // as soon as `expiresAt` is reached," not "0 seconds after insert."
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 },
  },
});

const PasswordResetTokenModel = model("PasswordResetToken", PasswordResetTokenSchema);

module.exports = { PasswordResetTokenModel };