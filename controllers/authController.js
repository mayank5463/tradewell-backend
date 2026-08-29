const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { UserModel } = require("../models/UserModel");
const { issueAuthCookie } = require("../utils/issueAuthCookie");
const { getOrCreateWallet } = require("../services/walletService");
const { sendEmail, verificationEmailTemplate, passwordResetEmailTemplate, premiumWelcomeTemplate } = require("../utils/sendEmail");

const tokenBlacklist = new Set();
const failedLogins = new Map();
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000;
const resetTokens = new Map();
const verificationTokens = new Map();

// ── HELPER: Check if account is locked ─────────────────────────────────
function isAccountLocked(email) {
  const record = failedLogins.get(email);
  if (!record) return false;

  if (record.lockedUntil && record.lockedUntil > Date.now()) {
    return true;
  }

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
  setTimeout(() => {
    tokenBlacklist.delete(token);
  }, 24 * 60 * 60 * 1000);
}

// ── HELPER: Check if token is blacklisted ──────────────────────────────
function isTokenBlacklisted(token) {
  return tokenBlacklist.has(token);
}

// ── HELPER: Validate password strength ─────────────────────────────────
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
// POST /signup - Advanced Signup with Email Verification & Premium Support
// ══════════════════════════════════════════════════════════════════════
async function signup(req, res) {
  console.log("[SIGNUP] Incoming request from:", req.headers.origin);

  const { name, email, password, isPremium } = req.body;

  // ── Basic Validation ─────────────────────────────────────────────────
  if (!name || !email || !password) {
    return res.status(400).json({ message: "All fields are required." });
  }

  if (name.trim().length < 2 || name.trim().length > 50) {
    return res.status(400).json({ message: "Name must be 2-50 characters." });
  }

  if (!/\S+@\S+\.\S+/.test(email)) {
    return res.status(400).json({ message: "Please enter a valid email address." });
  }

  // ── Password Strength Validation ─────────────────────────────────────
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
      console.warn("[SIGNUP] Email already registered:", normalizedEmail);
      return res.status(400).json({
        message: "This email is already registered. Please login instead.",
      });
    }

    // ── Hash Password ──────────────────────────────────────────────────
    const hashedPassword = await bcrypt.hash(password, 12);

    // ── Create User with Premium Support ───────────────────────────────
    const newUser = new UserModel({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      isEmailVerified: false,
      isPremium: isPremium === true,
      premiumExpiresAt: isPremium ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null,
      premiumActivatedAt: isPremium ? new Date() : null,
    });

    await newUser.save();
    console.log("[SIGNUP] ✅ New user created:", newUser.email, "| Premium:", isPremium);

    // ── Create Wallet ───────────────────────────────────────────────────
    await getOrCreateWallet(newUser._id);

    // ── Generate Email Verification Token ──────────────────────────────
    const verificationToken = crypto.randomBytes(32).toString("hex");
    verificationTokens.set(verificationToken, {
      userId: newUser._id,
      expires: Date.now() + 24 * 60 * 60 * 1000,
    });

    // ── Send Verification Email ────────────────────────────────────────
    const verificationLink = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;

    try {
      const emailTemplate = isPremium
        ? premiumWelcomeTemplate(verificationLink, newUser.name)
        : verificationEmailTemplate(verificationLink, newUser.name);

      await sendEmail({
        to: newUser.email,
        subject: isPremium
          ? "🎉 Welcome to Tradewell Premium!"
          : "Verify your Tradewell account",
        html: emailTemplate,
      });
      console.log("[SIGNUP] Email sent to:", newUser.email);
    } catch (emailError) {
      console.error("[SIGNUP] Email send failed:", emailError.message);
      // Don't fail signup if email fails
    }

    // ── Issue Auth Cookie ──────────────────────────────────────────────
    issueAuthCookie(res, newUser);

    return res.status(201).json({
      message: "Account created successfully! Please verify your email.",
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        isEmailVerified: false,
        isPremium: isPremium || false,
      },
    });
  } catch (err) {
    console.error("[SIGNUP] Error:", err.message);
    if (err.code === 11000) {
      return res.status(400).json({
        message: "Email already registered. Please login.",
      });
    }
    return res.status(500).json({
      message: "Server error. Please try again.",
    });
  }
}

// ══════════════════════════════════════════════════════════════════════
// POST /login - Advanced Login with Account Lockout & Premium Check
// ══════════════════════════════════════════════════════════════════════
async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required." });
  }

  const normalizedEmail = email.toLowerCase().trim();

  // ── Check Account Lockout ────────────────────────────────────────────
  if (isAccountLocked(normalizedEmail)) {
    const record = failedLogins.get(normalizedEmail);
    const minutesLeft = Math.ceil((record.lockedUntil - Date.now()) / 60000);
    return res.status(423).json({
      message: `Account temporarily locked. Try again in ${minutesLeft} minutes.`,
    });
  }

  try {
    // FIX: `password` has `select: false` on the schema, so a plain
    // findOne() never returns it. Without `.select("+password")` here,
    // `user.password` is `undefined` and bcrypt.compare() either throws
    // or always fails — every login attempt was breaking on this line.
    const user = await UserModel.findOne({ email: normalizedEmail }).select("+password");

    if (!user) {
      recordFailedLogin(normalizedEmail);
      return res.status(400).json({ message: "Invalid email or password." });
    }

    // ── Password Verification ──────────────────────────────────────────
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      recordFailedLogin(normalizedEmail);
      return res.status(400).json({ message: "Invalid email or password." });
    }

    // ── Clear Failed Attempts on Success ───────────────────────────────
    clearFailedLogins(normalizedEmail);
    console.log("[LOGIN] ✅ User logged in:", user.email);

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
        isPremium: user.isPremium || false,
        premiumExpiresAt: user.premiumExpiresAt,
      },
    });
  } catch (err) {
    console.error("[LOGIN] Error:", err.message);
    return res.status(500).json({ message: "Server error. Please try again." });
  }
}

// ══════════════════════════════════════════════════════════════════════
// POST /logout - Fixed Logout with Token Blacklist
// ══════════════════════════════════════════════════════════════════════
function logout(req, res) {
  const token = req.cookies?.token;

  if (token) {
    blacklistToken(token);
    console.log("[LOGOUT] Token blacklisted for user:", req.user?.email);
  }

  const isProd = process.env.NODE_ENV === "production";
  const cookieOpts = {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/",
    expires: new Date(0),
  };

  // Clear both cookies your issue/verify flow could ever set, not just
  // "token" — harmless today, and avoids a stale leftover cookie if a
  // refresh-token flow gets added later.
  res.clearCookie("token", cookieOpts);
  res.clearCookie("refreshToken", cookieOpts);

  return res.json({ message: "Logged out successfully.", success: true });
}

// ══════════════════════════════════════════════════════════════════════
// GET /check-auth - Enhanced with Blacklist Check
// ══════════════════════════════════════════════════════════════════════
function checkAuth(req, res) {
  // AuthMiddleware already verified the token and set req.user
  if (!req.user || !req.user.id) {
    return res.status(401).json({
      isAuthenticated: false,
      message: "Not authenticated",
    });
  }

  // Check if token is blacklisted
  const token = req.cookies?.token;
  if (token && isTokenBlacklisted(token)) {
    console.warn("[CHECK-AUTH] Blacklisted token used");
    return res.status(401).json({
      isAuthenticated: false,
      message: "Session expired. Please login again.",
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
// GET /profile - Get User Profile
// ══════════════════════════════════════════════════════════════════════
async function getProfile(req, res) {
  try {
    const user = await UserModel.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }
    return res.json(user);
  } catch (err) {
    console.error("[PROFILE] Error:", err.message);
    return res.status(500).json({ message: "Failed to fetch profile." });
  }
}

// ══════════════════════════════════════════════════════════════════════
// POST /change-password - Change Password
// ══════════════════════════════════════════════════════════════════════
async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      message: "Current and new password are both required.",
    });
  }

  // ── Validate New Password Strength ───────────────────────────────────
  const passwordCheck = validatePasswordStrength(newPassword);
  if (!passwordCheck.isValid) {
    return res.status(400).json({
      message: "New password must be at least 8 characters with uppercase, lowercase, number, and special character.",
    });
  }

  try {
    // Same fix as login: need the actual hash back to compare against.
    const user = await UserModel.findById(req.user.id).select("+password");
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Current password is incorrect." });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        message: "New password must be different from current password.",
      });
    }

    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();

    console.log("[CHANGE-PASSWORD] ✅ Password updated for:", user.email);
    return res.json({ message: "Password updated successfully." });
  } catch (err) {
    console.error("[CHANGE-PASSWORD] Error:", err.message);
    return res.status(500).json({ message: "Server error. Please try again." });
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

    // ── Always Return Same Response (Prevent User Enumeration) ─────────
    const genericResponse = {
      message: "If that email is registered, a reset link has been sent. Check your inbox.",
    };

    if (!user) {
      console.log("[FORGOT-PASSWORD] Email not found:", normalizedEmail);
      return res.json(genericResponse);
    }

    // ── Generate Secure Reset Token ────────────────────────────────────
    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // ── Store hashed token (NEVER store plain text) ──────────────────
    resetTokens.set(hashedToken, {
      userId: user._id,
      expires: Date.now() + 30 * 60 * 1000, // 30 minutes
    });

    console.log("[FORGOT-PASSWORD] Reset token created for:", user.email);

    // ── Send Reset Email ───────────────────────────────────────────────
    const resetLink = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    try {
      await sendEmail({
        to: user.email,
        subject: "🔐 Reset your Tradewell password",
        html: passwordResetEmailTemplate(resetLink, user.name),
      });
      console.log("[FORGOT-PASSWORD] Email sent to:", user.email);
    } catch (emailError) {
      console.error("[FORGOT-PASSWORD] Email failed:", emailError.message);
    }

    return res.json(genericResponse);
  } catch (err) {
    console.error("[FORGOT-PASSWORD] Error:", err.message);
    return res.status(500).json({ message: "Server error. Please try again." });
  }
}

// ══════════════════════════════════════════════════════════════════════
// POST /reset-password - Reset Password with Token
// ══════════════════════════════════════════════════════════════════════
async function resetPassword(req, res) {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({
      message: "Token and new password are required.",
    });
  }

  // ── Validate Password Strength ───────────────────────────────────────
  const passwordCheck = validatePasswordStrength(newPassword);
  if (!passwordCheck.isValid) {
    return res.status(400).json({
      message: "Password must be at least 8 characters with uppercase, lowercase, number, and special character.",
    });
  }

  try {
    // ── Hash the Token for Comparison ──────────────────────────────────
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const tokenData = resetTokens.get(hashedToken);

    // ── Validate Token ─────────────────────────────────────────────────
    if (!tokenData) {
      console.warn("[RESET-PASSWORD] Invalid token attempted");
      return res.status(400).json({
        message: "Invalid reset link. Please request a new one.",
      });
    }

    if (tokenData.expires < Date.now()) {
      resetTokens.delete(hashedToken);
      console.warn("[RESET-PASSWORD] Token expired");
      return res.status(400).json({
        message: "Reset link has expired. Please request a new one.",
      });
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
    console.error("[RESET-PASSWORD] Error:", err.message);
    return res.status(500).json({ message: "Server error. Please try again." });
  }
}

// ══════════════════════════════════════════════════════════════════════
// GET /verify-email/:token - Verify Email Address
// ══════════════════════════════════════════════════════════════════════
async function verifyEmail(req, res) {
  const { token } = req.params;

  if (!token) {
    return res.status(400).json({ message: "Verification token is required." });
  }

  try {
    const tokenData = verificationTokens.get(token);

    if (!tokenData) {
      return res.status(400).json({
        message: "Invalid verification link. Please request a new one.",
      });
    }

    if (tokenData.expires < Date.now()) {
      verificationTokens.delete(token);
      return res.status(400).json({
        message: "Verification link has expired. Please request a new one.",
      });
    }

    const user = await UserModel.findById(tokenData.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({ message: "Email is already verified." });
    }

    user.isEmailVerified = true;
    user.emailVerifiedAt = new Date();
    await user.save();

    verificationTokens.delete(token);

    console.log("[VERIFY-EMAIL] ✅ Email verified for:", user.email);
    return res.json({
      message: "Email verified successfully! You can now access all features.",
      user: {
        id: user._id,
        email: user.email,
        isEmailVerified: true,
      },
    });
  } catch (err) {
    console.error("[VERIFY-EMAIL] Error:", err.message);
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

    const genericResponse = {
      message: "If that email exists and is unverified, a verification link has been sent.",
    };

    if (!user) {
      return res.json(genericResponse);
    }

    if (user.isEmailVerified) {
      return res.json(genericResponse);
    }

    const verificationToken = crypto.randomBytes(32).toString("hex");
    verificationTokens.set(verificationToken, {
      userId: user._id,
      expires: Date.now() + 24 * 60 * 60 * 1000,
    });

    const verificationLink = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;

    await sendEmail({
      to: user.email,
      subject: "✉️ Verify your Tradewell account",
      html: verificationEmailTemplate(verificationLink, user.name),
    });

    console.log("[RESEND-VERIFICATION] Email sent to:", user.email);
    return res.json(genericResponse);
  } catch (err) {
    console.error("[RESEND-VERIFICATION] Error:", err.message);
    return res.status(500).json({ message: "Server error. Please try again." });
  }
}

// ══════════════════════════════════════════════════════════════════════
// PUT /update-profile - Update User Profile
// ══════════════════════════════════════════════════════════════════════
async function updateProfile(req, res) {
  const { name, phone, pan, gender, dob, address, city, state, pincode } = req.body;

  try {
    const user = await UserModel.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Update only provided fields
    if (name !== undefined) user.name = name.trim();
    if (phone !== undefined) user.phone = phone.trim();
    if (pan !== undefined) user.pan = pan.trim().toUpperCase();
    if (gender !== undefined) user.gender = gender;
    if (dob !== undefined) user.dob = dob;
    if (address !== undefined) user.address = address.trim();
    if (city !== undefined) user.city = city.trim();
    if (state !== undefined) user.state = state.trim();
    if (pincode !== undefined) user.pincode = pincode.trim();

    await user.save();

    console.log("[UPDATE-PROFILE] ✅ Profile updated for:", user.email);
    return res.json({
      message: "Profile updated successfully.",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        pan: user.pan,
        gender: user.gender,
        dob: user.dob,
        address: user.address,
        city: user.city,
        state: user.state,
        pincode: user.pincode,
      },
    });
  } catch (err) {
    console.error("[UPDATE-PROFILE] Error:", err.message);
    return res.status(500).json({ message: "Failed to update profile." });
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
  updateProfile,
};