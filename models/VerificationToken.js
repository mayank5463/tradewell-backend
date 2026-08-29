const { Schema, model } = require("mongoose");

// ══════════════════════════════════════════════════════════════════════
// EMAIL VERIFICATION TOKEN - Persisted replacement for the old
// in-memory `verificationTokens` Map in authController.js.
//
// Same reasoning as PasswordResetToken.js: a verification link is
// commonly clicked hours or days after signup (people don't always
// check email immediately). An in-memory Map that resets on every
// deploy meant real users' "verify your account" links silently broke
// whenever Render redeployed in between. This is unhashed on purpose
// (unlike the reset token) since the original implementation stored
// the raw token as the Map key and verifyEmail() looked it up directly
// by raw token from the URL param — kept identical here for drop-in
// compatibility with routes/authRoutes.js's `/verify-email/:token`.
// ══════════════════════════════════════════════════════════════════════

const VerificationTokenSchema = new Schema({
  token: {
    type: String,
    required: true,
    unique: true,
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 },
  },
});

const VerificationTokenModel = model("VerificationToken", VerificationTokenSchema);

module.exports = { VerificationTokenModel };