// const { Schema, model } = require("mongoose");

// // ══════════════════════════════════════════════════════════════════════
// // USER SCHEMA - With Premium Support
// // ══════════════════════════════════════════════════════════════════════

// const UserSchema = new Schema(
//   {
//     // ── CORE AUTHENTICATION ────────────────────────────────────────────
//     name: {
//       type: String,
//       required: [true, "Name is required"],
//       trim: true,
//       minlength: 2,
//       maxlength: 50,
//     },
//     email: {
//       type: String,
//       required: [true, "Email is required"],
//       unique: true,
//       lowercase: true,
//       trim: true,
//       match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, "Please provide a valid email"],
//     },
//     password: {
//       type: String,
//       required: [true, "Password is required"],
//       minlength: 6,
//       select: false,
//     },

//     // ── EMAIL VERIFICATION ─────────────────────────────────────────────
//     isEmailVerified: {
//       type: Boolean,
//       default: false,
//     },
//     emailVerifiedAt: {
//       type: Date,
//       default: null,
//     },

//     // ── PREMIUM FEATURES ───────────────────────────────────────────────
//     isPremium: {
//       type: Boolean,
//       default: false,
//     },
//     premiumActivatedAt: {
//       type: Date,
//       default: null,
//     },
//     premiumExpiresAt: {
//       type: Date,
//       default: null,
//     },
//     premiumAutoRenew: {
//       type: Boolean,
//       default: true,
//     },

//     // ── PROFILE FIELDS ─────────────────────────────────────────────────
//     phone: {
//       type: String,
//       default: "",
//       trim: true,
//     },
//     pan: {
//       type: String,
//       default: "",
//       trim: true,
//       uppercase: true,
//       match: [/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Please provide a valid PAN"],
//     },
//     gender: {
//       type: String,
//       default: "",
//       enum: ["", "male", "female", "other", "prefer_not_to_say"],
//     },
//     dob: {
//       type: String,
//       default: "",
//     },

//     // ── ADDRESS INFORMATION ────────────────────────────────────────────
//     address: {
//       type: String,
//       default: "",
//       trim: true,
//     },
//     city: {
//       type: String,
//       default: "",
//       trim: true,
//     },
//     state: {
//       type: String,
//       default: "",
//       trim: true,
//     },
//     pincode: {
//       type: String,
//       default: "",
//       trim: true,
//       match: [/^[0-9]{6}$/, "Please provide a valid 6-digit pincode"],
//     },

//     // ── ACCOUNT STATUS ─────────────────────────────────────────────────
//     isActive: {
//       type: Boolean,
//       default: true,
//     },
//     isBlocked: {
//       type: Boolean,
//       default: false,
//     },
//     blockedReason: {
//       type: String,
//       default: null,
//     },

//     // ── PREFERENCES ────────────────────────────────────────────────────
//     theme: {
//       type: String,
//       enum: ["light", "dark"],
//       default: "light",
//     },
//     notifications: {
//       email: { type: Boolean, default: true },
//       push: { type: Boolean, default: true },
//       sms: { type: Boolean, default: false },
//     },
//     language: {
//       type: String,
//       default: "en",
//       enum: ["en", "hi", "gu", "mr"],
//     },

//     // ── SECURITY & LOGIN TRACKING ──────────────────────────────────────
//     lastLoginAt: {
//       type: Date,
//       default: null,
//     },
//     lastLoginIp: {
//       type: String,
//       default: null,
//     },
//     loginAttempts: {
//       type: Number,
//       default: 0,
//     },
//     accountLockedUntil: {
//       type: Date,
//       default: null,
//     },

//     // ── METADATA ───────────────────────────────────────────────────────
//     userAgent: {
//       type: String,
//       default: null,
//     },
//     referralCode: {
//       type: String,
//       unique: true,
//       sparse: true,
//       default: null,
//     },
//     referredBy: {
//       type: Schema.Types.ObjectId,
//       ref: "User",
//       default: null,
//     },
//   },
//   {
//     timestamps: true,
//   },
// );

// // ── INDEXES FOR PERFORMANCE ────────────────────────────────────────────
// UserSchema.index({ email: 1 });
// UserSchema.index({ referralCode: 1 });
// UserSchema.index({ createdAt: -1 });
// UserSchema.index({ isPremium: 1, premiumExpiresAt: 1 });

// // ── VIRTUAL FOR PREMIUM STATUS ─────────────────────────────────────────
// UserSchema.virtual("isPremiumActive").get(function () {
//   if (!this.isPremium) return false;
//   if (!this.premiumExpiresAt) return true;
//   return new Date() < new Date(this.premiumExpiresAt);
// });

// // ── VIRTUAL FOR DAYS UNTIL PREMIUM EXPIRES ─────────────────────────────
// UserSchema.virtual("premiumDaysRemaining").get(function () {
//   if (!this.premiumExpiresAt || !this.isPremiumActive) return 0;
//   const today = new Date();
//   const expiryDate = new Date(this.premiumExpiresAt);
//   const diffTime = expiryDate - today;
//   const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
//   return Math.max(0, diffDays);
// });

// // ── METHOD: Check if account is locked ──────────────────────────────────
// UserSchema.methods.isAccountLocked = function () {
//   if (!this.accountLockedUntil) return false;
//   if (new Date() < new Date(this.accountLockedUntil)) return true;
//   // Unlock if time has passed
//   this.accountLockedUntil = null;
//   return false;
// };

// // ── METHOD: Record failed login attempt ────────────────────────────────
// UserSchema.methods.recordFailedLogin = async function () {
//   this.loginAttempts += 1;
//   if (this.loginAttempts >= 5) {
//     this.accountLockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
//     this.loginAttempts = 0;
//   }
//   await this.save();
// };

// // ── METHOD: Clear failed login attempts ────────────────────────────────
// UserSchema.methods.clearFailedLoginAttempts = async function () {
//   this.loginAttempts = 0;
//   this.lastLoginAt = new Date();
//   this.accountLockedUntil = null;
//   await this.save();
// };

// // ── METHOD: Verify email ───────────────────────────────────────────────
// UserSchema.methods.verifyEmail = async function () {
//   this.isEmailVerified = true;
//   this.emailVerifiedAt = new Date();
//   if (this.isPremium && !this.premiumActivatedAt) {
//     this.premiumActivatedAt = new Date();
//   }
//   await this.save();
// };

// // ── METHOD: Activate premium ───────────────────────────────────────────
// UserSchema.methods.activatePremium = async function (daysValid = 30) {
//   this.isPremium = true;
//   this.premiumActivatedAt = new Date();
//   this.premiumExpiresAt = new Date(Date.now() + daysValid * 24 * 60 * 60 * 1000);
//   this.premiumAutoRenew = true;
//   await this.save();
// };

// // ── METHOD: Deactivate premium ─────────────────────────────────────────
// UserSchema.methods.deactivatePremium = async function () {
//   this.isPremium = false;
//   this.premiumAutoRenew = false;
//   await this.save();
// };

// // ── STATICS: Generate referral code ────────────────────────────────────
// UserSchema.statics.generateReferralCode = function () {
//   return Math.random().toString(36).substring(2, 8).toUpperCase();
// };

// // ══════════════════════════════════════════════════════════════════════
// // MIDDLEWARE: Generate referral code on creation
// // ══════════════════════════════════════════════════════════════════════
// // FIX: this hook used to declare `function (next)` while ALSO being (or
// // getting edited into) an async function. Mongoose looks at the hook's
// // arity/signature to decide which style you're using — an async function
// // is treated as "promise style," so Mongoose never actually supplies a
// // `next` callback to call. Any attempt to call next(...) inside then
// // throws "next is not a function", which crashed every signup here.
// //
// // The fix is to pick ONE style and stick to it. This uses plain
// // async/await with NO `next` parameter at all — Mongoose awaits the
// // returned promise automatically, and throwing an Error inside is enough
// // to fail the save() with that error. Simpler, and immune to this bug.
// UserSchema.pre("save", async function () {
//   if (!this.isNew || this.referralCode) return;

//   let code;
//   let exists = true;
//   let attempts = 0;
//   const maxAttempts = 100;

//   while (exists && attempts < maxAttempts) {
//     attempts++;
//     code = this.constructor.generateReferralCode();
//     exists = await this.constructor.findOne({ referralCode: code });
//   }

//   if (attempts >= maxAttempts) {
//     throw new Error(`Failed to generate a unique referral code after ${maxAttempts} attempts`);
//   }

//   this.referralCode = code;
// });

// // ── MIDDLEWARE: Hide sensitive fields on retrieval ─────────────────────
// UserSchema.methods.toJSON = function () {
//   const user = this.toObject();
//   delete user.password;
//   delete user.loginAttempts;
//   delete user.accountLockedUntil;
//   return user;
// };

// const UserModel = model("User", UserSchema);

// module.exports = { UserSchema, UserModel };










































































































const { Schema, model } = require("mongoose");

// ══════════════════════════════════════════════════════════════════════
// USER SCHEMA - With Premium Support
// ══════════════════════════════════════════════════════════════════════

const UserSchema = new Schema(
  {
    // ── CORE AUTHENTICATION ────────────────────────────────────────────
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: 2,
      maxlength: 50,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true, // this alone already creates the index — see note below
      lowercase: true,
      trim: true,
      match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, "Please provide a valid email"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      // FIX: was 6, but authController's validatePasswordStrength()
      // actually requires 8+ chars with upper/lower/number/special.
      // The old value of 6 here was dead weight (the controller check
      // always fired first and was stricter) but misleading to anyone
      // reading the schema in isolation — bumped to match reality.
      minlength: 8,
      select: false,
    },

    // ── EMAIL VERIFICATION ─────────────────────────────────────────────
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerifiedAt: {
      type: Date,
      default: null,
    },

    // ── PREMIUM FEATURES ───────────────────────────────────────────────
    isPremium: {
      type: Boolean,
      default: false,
    },
    premiumActivatedAt: {
      type: Date,
      default: null,
    },
    premiumExpiresAt: {
      type: Date,
      default: null,
    },
    premiumAutoRenew: {
      type: Boolean,
      default: true,
    },

    // ── PROFILE FIELDS ─────────────────────────────────────────────────
    phone: {
      type: String,
      default: "",
      trim: true,
    },
    pan: {
      type: String,
      default: "",
      trim: true,
      uppercase: true,
      match: [/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Please provide a valid PAN"],
    },
    gender: {
      type: String,
      default: "",
      enum: ["", "male", "female", "other", "prefer_not_to_say"],
    },
    dob: {
      type: String,
      default: "",
    },

    // ── ADDRESS INFORMATION ────────────────────────────────────────────
    address: {
      type: String,
      default: "",
      trim: true,
    },
    city: {
      type: String,
      default: "",
      trim: true,
    },
    state: {
      type: String,
      default: "",
      trim: true,
    },
    pincode: {
      type: String,
      default: "",
      trim: true,
      match: [/^[0-9]{6}$/, "Please provide a valid 6-digit pincode"],
    },

    // ── ACCOUNT STATUS ─────────────────────────────────────────────────
    isActive: {
      type: Boolean,
      default: true,
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    blockedReason: {
      type: String,
      default: null,
    },

    // ── PREFERENCES ────────────────────────────────────────────────────
    theme: {
      type: String,
      enum: ["light", "dark"],
      default: "light",
    },
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
    },
    language: {
      type: String,
      default: "en",
      enum: ["en", "hi", "gu", "mr"],
    },

    // ── SECURITY & LOGIN TRACKING ──────────────────────────────────────
    // These fields power isAccountLocked() / recordFailedLogin() /
    // clearFailedLoginAttempts() below. authController.js now calls
    // these methods directly instead of tracking failed logins in a
    // separate in-memory Map, so lockouts survive a server restart.
    lastLoginAt: {
      type: Date,
      default: null,
    },
    lastLoginIp: {
      type: String,
      default: null,
    },
    loginAttempts: {
      type: Number,
      default: 0,
    },
    accountLockedUntil: {
      type: Date,
      default: null,
    },

    // ── METADATA ───────────────────────────────────────────────────────
    userAgent: {
      type: String,
      default: null,
    },
    referralCode: {
      type: String,
      unique: true, // this alone already creates the index — see note below
      sparse: true,
      default: null,
    },
    referredBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// ── INDEXES FOR PERFORMANCE ────────────────────────────────────────────
// FIX: `email` and `referralCode` already get an index automatically
// from `unique: true` above — the explicit `.index()` calls for those
// two were duplicates and were the source of the Mongoose
// "Duplicate schema index" warnings on boot. Removed. The two below
// are NOT declared anywhere else, so they stay.
UserSchema.index({ createdAt: -1 });
UserSchema.index({ isPremium: 1, premiumExpiresAt: 1 });

// ── VIRTUAL FOR PREMIUM STATUS ─────────────────────────────────────────
UserSchema.virtual("isPremiumActive").get(function () {
  if (!this.isPremium) return false;
  if (!this.premiumExpiresAt) return true;
  return new Date() < new Date(this.premiumExpiresAt);
});

// ── VIRTUAL FOR DAYS UNTIL PREMIUM EXPIRES ─────────────────────────────
UserSchema.virtual("premiumDaysRemaining").get(function () {
  if (!this.premiumExpiresAt || !this.isPremiumActive) return 0;
  const today = new Date();
  const expiryDate = new Date(this.premiumExpiresAt);
  const diffTime = expiryDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
});

// ── METHOD: Check if account is locked ──────────────────────────────────
UserSchema.methods.isAccountLocked = function () {
  if (!this.accountLockedUntil) return false;
  if (new Date() < new Date(this.accountLockedUntil)) return true;
  // Unlock if time has passed
  this.accountLockedUntil = null;
  return false;
};

// ── METHOD: Record failed login attempt ────────────────────────────────
UserSchema.methods.recordFailedLogin = async function () {
  this.loginAttempts += 1;
  if (this.loginAttempts >= 5) {
    this.accountLockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    this.loginAttempts = 0;
    console.warn(`[SECURITY] Account locked: ${this.email} for 15 minutes`);
  }
  await this.save();
};

// ── METHOD: Clear failed login attempts ────────────────────────────────
UserSchema.methods.clearFailedLoginAttempts = async function () {
  this.loginAttempts = 0;
  this.lastLoginAt = new Date();
  this.accountLockedUntil = null;
  await this.save();
};

// ── METHOD: Verify email ───────────────────────────────────────────────
UserSchema.methods.verifyEmail = async function () {
  this.isEmailVerified = true;
  this.emailVerifiedAt = new Date();
  if (this.isPremium && !this.premiumActivatedAt) {
    this.premiumActivatedAt = new Date();
  }
  await this.save();
};

// ── METHOD: Activate premium ───────────────────────────────────────────
UserSchema.methods.activatePremium = async function (daysValid = 30) {
  this.isPremium = true;
  this.premiumActivatedAt = new Date();
  this.premiumExpiresAt = new Date(Date.now() + daysValid * 24 * 60 * 60 * 1000);
  this.premiumAutoRenew = true;
  await this.save();
};

// ── METHOD: Deactivate premium ─────────────────────────────────────────
UserSchema.methods.deactivatePremium = async function () {
  this.isPremium = false;
  this.premiumAutoRenew = false;
  await this.save();
};

// ── STATICS: Generate referral code ────────────────────────────────────
UserSchema.statics.generateReferralCode = function () {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

// ══════════════════════════════════════════════════════════════════════
// MIDDLEWARE: Generate referral code on creation
// ══════════════════════════════════════════════════════════════════════
UserSchema.pre("save", async function () {
  if (!this.isNew || this.referralCode) return;

  let code;
  let exists = true;
  let attempts = 0;
  const maxAttempts = 100;

  while (exists && attempts < maxAttempts) {
    attempts++;
    code = this.constructor.generateReferralCode();
    exists = await this.constructor.findOne({ referralCode: code });
  }

  if (attempts >= maxAttempts) {
    throw new Error(`Failed to generate a unique referral code after ${maxAttempts} attempts`);
  }

  this.referralCode = code;
});

// ── MIDDLEWARE: Hide sensitive fields on retrieval ─────────────────────
UserSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  delete user.loginAttempts;
  delete user.accountLockedUntil;
  return user;
};

const UserModel = model("User", UserSchema);

module.exports = { UserSchema, UserModel };