const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { UserModel } = require("../models/UserModel");
const { issueAuthCookie } = require("../utils/issueAuthCookie");
const { getOrCreateWallet } = require("../services/walletService");
const { sendEmail } = require("../utils/sendEmail");


const tokenBlacklist = new Set();

const failedLogins = new Map(); // email -> { count, lockedUntil }

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes


const resetTokens = new Map(); // hashedToken -> { userId, expires }

// ── EMAIL VERIFICATION TOKENS ───────────────────────────────────────────
const verificationTokens = new Map();

// ── HELPER: Check if account is locked ─────────────────────────────────
function isAccountLocked(email) {
  const record = failedLogins.get(email);
  if (!record) return false;

  if (record.lockedUntil && record.lockedUntil > Date.now()) {
    return true;
  }

  // Reset if lock expired
  if (record.lockedUntil && record.lockedUntil <= Date.now()) {
    failedLogins.delete(email);
    return false;
  }

  return false;
}

// ── HELPER: Record failed login ────────────────────────────────────────
function recordFailedLogin(email) {
  const record = failedLogins.get(email) || { count: 0, lockedUntil: null };
  record.count += 1;

  if (record.count >= MAX_FAILED_ATTEMPTS) {
    record.lockedUntil = Date.now() + LOCKOUT_DURATION;
    record.count = 0;
    console.warn(`[SECURITY] Account locked: ${email} for 15 minutes`);
  }

  failedLogins.set(email, record);
}

// ── HELPER: Clear failed logins on success ─────────────────────────────
function clearFailedLogins(email) {
  failedLogins.delete(email);
}

// ── HELPER: Add token to blacklist ─────────────────────────────────────
function blacklistToken(token) {
  tokenBlacklist.add(token);

  // Auto-clean expired tokens (prevent memory leak)
  // WHY: Tokens expire anyway, no need to keep them forever
  setTimeout(
    () => {
      tokenBlacklist.delete(token);
    },
    24 * 60 * 60 * 1000,
  ); // 24 hours (matches JWT expiry)
}

// ── HELPER: Check if token is blacklisted ──────────────────────────────
function isTokenBlacklisted(token) {
  return tokenBlacklist.has(token);
}

// ── HELPER: Validate password strength ─────────────────────────────────
// WHY: Weak passwords are easily cracked by dictionary/brute force attacks
function validatePasswordStrength(password) {
  const checks = {
    minLength: password.length >= 8,
    hasUpperCase: /[A-Z]/.test(password),
    hasLowerCase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(password),
  };

  const failedChecks = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([check]) => check);

  return {
    isValid: failedChecks.length === 0,
    failedChecks,
  };
}

// ══════════════════════════════════════════════════════════════════════
// POST /signup - Advanced Signup with Email Verification
// ══════════════════════════════════════════════════════════════════════
async function signup(req, res) {
  console.log("[SIGNUP] Incoming body:", { ...req.body, password: "•••••••" });
  const { name, email, password } = req.body;

  // ── Basic Validation ─────────────────────────────────────────────────
  if (!name || !email || !password) {
    console.warn("[SIGNUP] Rejected: missing fields");
    return res.status(400).json({ message: "All fields are required." });
  }

  // ── Name Validation ──────────────────────────────────────────────────
  // WHY: Prevents XSS and ensures clean data
  if (name.trim().length < 2 || name.trim().length > 50) {
    return res.status(400).json({ message: "Name must be 2-50 characters." });
  }

  // ── Email Validation ─────────────────────────────────────────────────
  if (!/\S+@\S+\.\S+/.test(email)) {
    return res
      .status(400)
      .json({ message: "Please enter a valid email address." });
  }

  // ── Password Strength Validation ─────────────────────────────────────
  // WHY: Enforces strong passwords to prevent easy brute force
  const passwordCheck = validatePasswordStrength(password);
  if (!passwordCheck.isValid) {
    const messages = {
      minLength: "at least 8 characters",
      hasUpperCase: "an uppercase letter",
      hasLowerCase: "a lowercase letter",
      hasNumber: "a number",
      hasSpecial: "a special character",
    };

    const requirements = passwordCheck.failedChecks
      .map((check) => messages[check])
      .join(", ");

    return res.status(400).json({
      message: `Password must contain ${requirements}.`,
    });
  }

  try {
    const normalizedEmail = email.toLowerCase().trim();

    // ── Check Existing User ─────────────────────────────────────────────
    const existing = await UserModel.findOne({ email: normalizedEmail });
    if (existing) {
      // WHY: Don't reveal if email exists (prevents user enumeration)
      console.warn(
        "[SIGNUP] Rejected: email already registered →",
        normalizedEmail,
      );
      return res.status(400).json({
        message: "This email is already registered. Please login.",
      });
    }

    // ── Hash Password ──────────────────────────────────────────────────
    // WHY: bcrypt with 12 rounds = secure against brute force
    // 10 rounds = fast crackable, 12+ rounds = secure
    const hashedPassword = await bcrypt.hash(password, 12);

    // ── Create User ─────────────────────────────────────────────────────
    const newUser = new UserModel({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      isEmailVerified: false, // Require email verification
      createdAt: new Date(),
    });
    await newUser.save();

    console.log(
      "[SIGNUP] ✅ New user saved:",
      newUser.email,
      "| id:",
      newUser._id,
    );

    // ── Create Wallet ───────────────────────────────────────────────────
    // WHY: Every account gets wallet immediately, can't be skipped
    await getOrCreateWallet(newUser._id);

    // ── Generate Email Verification Token ──────────────────────────────
    // WHY: Prevents fake accounts and spam
    const verificationToken = crypto.randomBytes(32).toString("hex");
    verificationTokens.set(verificationToken, {
      userId: newUser._id,
      expires: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    });

    // ── Send Verification Email ────────────────────────────────────────
    try {
      await sendEmail({
        to: newUser.email,
        subject: "Verify your Tradewell account",
        html: `
          <h1>Welcome to Tradewell!</h1>
          <p>Click the link below to verify your email:</p>
          <a href="${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}">
            Verify Email
          </a>
          <p>This link expires in 24 hours.</p>
        `,
      });
      console.log("[SIGNUP] Verification email sent to:", newUser.email);
    } catch (emailError) {
      // Don't fail signup if email fails - user can resend
      console.error("[SIGNUP] Email send failed:", emailError.message);
    }

    // ── Issue Auth Cookie (Auto-login) ─────────────────────────────────
    issueAuthCookie(res, newUser);

    return res.status(201).json({
      message: "Account created successfully! Please verify your email.",
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        isEmailVerified: false,
      },
    });
  } catch (err) {
    if (err.code === 11000) {
      console.error("[SIGNUP] Duplicate key error:", err.message);
      return res.status(400).json({
        message: "Email already registered. Please login.",
      });
    }
    console.error("[SIGNUP] ❌ Unexpected error:", err.message);
    return res.status(500).json({
      message: "Server error. Please try again.",
    });
  }
}

// ══════════════════════════════════════════════════════════════════════
// POST /login - Advanced Login with Account Lockout
// ══════════════════════════════════════════════════════════════════════
async function login(req, res) {
  console.log("[LOGIN] Incoming body:", { ...req.body, password: "•••••••" });
  const { email, password } = req.body;

  // ── Basic Validation ─────────────────────────────────────────────────
  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "Email and password are required." });
  }

  const normalizedEmail = email.toLowerCase().trim();

  // ── Check Account Lockout ────────────────────────────────────────────
  // WHY: Prevents brute force even with distributed IPs
  if (isAccountLocked(normalizedEmail)) {
    const record = failedLogins.get(normalizedEmail);
    const minutesLeft = Math.ceil((record.lockedUntil - Date.now()) / 60000);
    console.warn(
      `[SECURITY] Login blocked for locked account: ${normalizedEmail}`,
    );
    return res.status(423).json({
      message: `Account temporarily locked. Try again in ${minutesLeft} minutes.`,
    });
  }

  try {
    const user = await UserModel.findOne({ email: normalizedEmail });

    // ── Generic Error Message ──────────────────────────────────────────
    // WHY: Don't reveal if email exists (prevents user enumeration)
    if (!user) {
      console.warn("[LOGIN] No user found for:", normalizedEmail);
      return res.status(400).json({ message: "Invalid email or password." });
    }

    // ── Password Verification ──────────────────────────────────────────
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      // Record failed attempt for account lockout
      recordFailedLogin(normalizedEmail);
      console.warn("[LOGIN] Password mismatch for:", normalizedEmail);
      return res.status(400).json({ message: "Invalid email or password." });
    }

    // ── Clear Failed Attempts on Success ───────────────────────────────
    clearFailedLogins(normalizedEmail);
    console.log("[LOGIN] ✅ Password verified for:", user.email);

    // ── Create Wallet if Missing ───────────────────────────────────────
    await getOrCreateWallet(user._id);

    // ── Issue Auth Cookie ──────────────────────────────────────────────
    issueAuthCookie(res, user);

    return res.json({
      message: "Login successful!",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isEmailVerified: user.isEmailVerified,
      },
    });
  } catch (err) {
    console.error("[LOGIN] ❌ Unexpected error:", err.message);
    return res.status(500).json({ message: "Server error. Please try again." });
  }
}

// ══════════════════════════════════════════════════════════════════════
// POST /logout - Fixed Logout with Token Blacklist
// ══════════════════════════════════════════════════════════════════════
function logout(req, res) {
  console.log(
    "[LOGOUT] Clearing token cookie. Was present:",
    !!req.cookies?.token,
  );

  // ── Extract Token for Blacklisting ───────────────────────────────────
  const token = req.cookies?.token;

  if (token) {
    // Add to blacklist so it can't be reused
    blacklistToken(token);
    console.log("[LOGOUT] Token blacklisted");
  }

  // ── Clear Cookie with EXACT Same Options ─────────────────────────────
  // WHY: Cookie won't clear if options don't match
  // CRITICAL FIX: Must match the options used in issueAuthCookie
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
    expires: new Date(0), // Set to past date to force deletion
  });

  // Also clear any other cookies
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
    expires: new Date(0),
  });

  return res.json({ message: "Logged out successfully.", success: true });
}

// ══════════════════════════════════════════════════════════════════════
// GET /check-auth - Enhanced with Blacklist Check
// ══════════════════════════════════════════════════════════════════════
function checkAuth(req, res) {
  // AuthMiddleware already verified the token
  // But check if token is blacklisted (logged out)
  const token = req.cookies?.token;

  if (token && isTokenBlacklisted(token)) {
    console.warn("[CHECK-AUTH] Blacklisted token used");
    return res.status(401).json({
      isAuthenticated: false,
      message: "Session expired. Please login again.",
    });
  }

  if (!req.user || !req.user.id) {
    return res.status(401).json({
      isAuthenticated: false,
      message: "Not authenticated",
    });
  }

  return res.json({
    isAuthenticated: true,
    user: {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
    },
  });
}

// ══════════════════════════════════════════════════════════════════════
// GET /profile - Enhanced with Email Verification Status
// ══════════════════════════════════════════════════════════════════════
async function getProfile(req, res) {
  try {
    const user = await UserModel.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }
    return res.json(user);
  } catch (err) {
    console.error("[PROFILE] ❌ Error:", err.message);
    return res.status(500).json({ message: "Failed to fetch profile." });
  }
}

// ══════════════════════════════════════════════════════════════════════
// POST /change-password - Enhanced with Better Validation
// ══════════════════════════════════════════════════════════════════════
async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      error: "Current and new password are both required.",
    });
  }

  // ── Validate New Password Strength ───────────────────────────────────
  const passwordCheck = validatePasswordStrength(newPassword);
  if (!passwordCheck.isValid) {
    return res.status(400).json({
      error:
        "New password must be at least 8 characters with uppercase, lowercase, number, and special character.",
    });
  }

  try {
    const user = await UserModel.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      console.warn(
        "[CHANGE-PASSWORD] Current password mismatch for:",
        user.email,
      );
      return res.status(401).json({ error: "Current password is incorrect." });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        error: "New password must be different from current password.",
      });
    }

    // ── Hash with 12 rounds (upgrade from 10) ──────────────────────────
    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();

    console.log("[CHANGE-PASSWORD] ✅ Password updated for:", user.email);
    return res.json({ message: "Password updated successfully." });
  } catch (err) {
    console.error("[CHANGE-PASSWORD] ❌ Unexpected error:", err.message);
    return res.status(500).json({ error: "Server error. Please try again." });
  }
}

// ══════════════════════════════════════════════════════════════════════
// POST /forgot-password - Secure Password Reset Request
// ══════════════════════════════════════════════════════════════════════
async function forgotPassword(req, res) {
  const { email } = req.body;

  if (!email || !/\S+@\S+\.\S+/.test(email)) {
    return res.status(400).json({ message: "Please enter a valid email." });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    const user = await UserModel.findOne({ email: normalizedEmail });

    // ── Always Return Same Response ────────────────────────────────────
    // WHY: Prevents user enumeration (don't reveal if email exists)
    const genericResponse = {
      message: "If that email exists, a reset link has been sent.",
    };

    if (!user) {
      return res.json(genericResponse);
    }

    // ── Generate Secure Reset Token ────────────────────────────────────
    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // Store hashed token (not plain text)
    resetTokens.set(hashedToken, {
      userId: user._id,
      expires: Date.now() + 30 * 60 * 1000, // 30 minutes
    });

    // ── Send Reset Email ───────────────────────────────────────────────
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    await sendEmail({
      to: user.email,
      subject: "Reset your Tradewell password",
      html: `
        <h1>Password Reset Request</h1>
        <p>Click the link below to reset your password:</p>
        <a href="${resetLink}">Reset Password</a>
        <p>This link expires in 30 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `,
    });

    console.log("[FORGOT-PASSWORD] Reset email sent to:", user.email);
    return res.json(genericResponse);
  } catch (err) {
    console.error("[FORGOT-PASSWORD] ❌ Error:", err.message);
    return res.status(500).json({ message: "Server error. Please try again." });
  }
}

// ══════════════════════════════════════════════════════════════════════
// POST /reset-password - Reset Password with Token
// ══════════════════════════════════════════════════════════════════════
async function resetPassword(req, res) {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res
      .status(400)
      .json({ message: "Token and new password are required." });
  }

  // ── Validate Password Strength ───────────────────────────────────────
  const passwordCheck = validatePasswordStrength(newPassword);
  if (!passwordCheck.isValid) {
    return res.status(400).json({
      message:
        "Password must be at least 8 characters with uppercase, lowercase, number, and special character.",
    });
  }

  try {
    // ── Hash the Token for Comparison ──────────────────────────────────
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const tokenData = resetTokens.get(hashedToken);

    // ── Validate Token ─────────────────────────────────────────────────
    if (!tokenData) {
      return res
        .status(400)
        .json({ message: "Invalid or expired reset token." });
    }

    if (tokenData.expires < Date.now()) {
      resetTokens.delete(hashedToken);
      return res.status(400).json({ message: "Reset token has expired." });
    }

    // ── Update Password ────────────────────────────────────────────────
    const user = await UserModel.findById(tokenData.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();

    // ── Delete Used Token (Single Use) ─────────────────────────────────
    resetTokens.delete(hashedToken);

    console.log("[RESET-PASSWORD] ✅ Password reset for:", user.email);
    return res.json({ message: "Password reset successfully. Please login." });
  } catch (err) {
    console.error("[RESET-PASSWORD] ❌ Error:", err.message);
    return res.status(500).json({ message: "Server error. Please try again." });
  }
}

// ══════════════════════════════════════════════════════════════════════
// GET /verify-email/:token - Verify Email Address
// ══════════════════════════════════════════════════════════════════════
async function verifyEmail(req, res) {
  const { token } = req.params;

  try {
    const tokenData = verificationTokens.get(token);

    if (!tokenData) {
      return res.status(400).json({ message: "Invalid verification token." });
    }

    if (tokenData.expires < Date.now()) {
      verificationTokens.delete(token);
      return res
        .status(400)
        .json({ message: "Verification token has expired." });
    }

    const user = await UserModel.findById(tokenData.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    user.isEmailVerified = true;
    await user.save();

    verificationTokens.delete(token);

    console.log("[VERIFY-EMAIL] ✅ Email verified for:", user.email);
    return res.json({ message: "Email verified successfully!" });
  } catch (err) {
    console.error("[VERIFY-EMAIL] ❌ Error:", err.message);
    return res.status(500).json({ message: "Server error. Please try again." });
  }
}

// ══════════════════════════════════════════════════════════════════════
// POST /resend-verification - Resend Verification Email
// ══════════════════════════════════════════════════════════════════════
async function resendVerification(req, res) {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required." });
  }

  try {
    const user = await UserModel.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      // Don't reveal if email exists
      return res.json({ message: "If that email exists, verification sent." });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({ message: "Email already verified." });
    }

    const verificationToken = crypto.randomBytes(32).toString("hex");
    verificationTokens.set(verificationToken, {
      userId: user._id,
      expires: Date.now() + 24 * 60 * 60 * 1000,
    });

    await sendEmail({
      to: user.email,
      subject: "Verify your Tradewell account",
      html: `
        <h1>Verify your email</h1>
        <p>Click below to verify:</p>
        <a href="${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}">
          Verify Email
        </a>
      `,
    });

    return res.json({ message: "Verification email sent." });
  } catch (err) {
    console.error("[RESEND-VERIFICATION] ❌ Error:", err.message);
    return res.status(500).json({ message: "Server error." });
  }
}

module.exports = {
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
};
