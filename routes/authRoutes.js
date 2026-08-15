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
} = require("../controllers/authController");

// RATE LIMITERS 

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts. Please try again in 15 minutes." }
});

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { message: "Too many accounts created. Please try again later." }
});

const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { message: "Too many password reset requests. Please try again later." }
});

// ── PUBLIC ROUTES (No Auth Required) ────────────────────────────────────

router.post("/signup", signupLimiter, signup);
router.post("/login", loginLimiter, login);
router.post("/forgot-password", passwordResetLimiter, forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/verify-email/:token", verifyEmail);
router.post("/resend-verification", resendVerification);


router.post("/logout", logout); 

router.get("/check-auth", AuthMiddleware, checkAuth);
router.get("/profile", AuthMiddleware, getProfile);
router.post("/change-password", AuthMiddleware, changePassword);

module.exports = router;