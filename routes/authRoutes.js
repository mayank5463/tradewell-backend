const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");

const { AuthMiddleware } = require("../middleware/AuthMiddleware");
const {
  signup,
  login,
  logout,
  checkAuth,
  getProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification,
  updateProfile,
} = require("../controllers/authController");

// RATE LIMITERS
// These are the ONLY rate limiters applied to these paths now — the
// old duplicate `authLimiter` (20/15min) that also lived in app.js has
// been removed since it was redundant with these, more precisely
// tuned, per-route limiters.

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many login attempts. Please try again in 15 minutes.",
  },
});

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { message: "Too many accounts created. Please try again later." },
});

const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: {
    message: "Too many password reset requests. Please try again later.",
  },
});

// ── PUBLIC ROUTES (No Auth Required) ────────────────────────────────────

router.post("/signup", signupLimiter, signup);
router.post("/login", loginLimiter, login);
router.post("/forgot-password", passwordResetLimiter, forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/verify-email/:token", verifyEmail);
router.post("/resend-verification", resendVerification);

// ── PROTECTED ROUTES ────────────────────────────────────────────────────

router.get("/check-auth", AuthMiddleware, checkAuth);

// csrfGuard is now applied globally in app.js to every non-GET route in
// the whole app, not just these three — see middleware/csrfGuard.js for
// why. No per-route wiring needed here anymore.
router.post("/logout", AuthMiddleware, logout);
router.get("/profile", AuthMiddleware, getProfile);
router.post("/change-password", AuthMiddleware, changePassword);
router.put("/update-profile", AuthMiddleware, updateProfile);

module.exports = router;