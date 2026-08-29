

require("dotenv").config();

console.log("─────────────────────────────────────────────");
console.log("[BOOT] Environment check:");
console.log(
  "  MONGO_URL           :",
  process.env.MONGO_URL ? "✅ loaded" : "❌ MISSING",
);
console.log(
  "  JWT_SECRET          :",
  process.env.JWT_SECRET ? "✅ loaded" : "❌ MISSING",
);
console.log(
  "  PORT                :",
  process.env.PORT || 3002,
  "(default fallback if unset)",
);
console.log(
  "  FRONTEND_URL        :",
  process.env.FRONTEND_URL || "❌ MISSING",
);
console.log(
  "  DASHBOARD_URL       :",
  process.env.DASHBOARD_URL || "❌ MISSING",
);
console.log(
  "  UPSTOX_ANALYTICS_TOKEN:",
  process.env.UPSTOX_ANALYTICS_TOKEN ? "✅ loaded" : "❌ MISSING",
);
console.log(
  "  INDIANAPI_KEY       :",
  process.env.INDIANAPI_KEY
    ? `✅ loaded (starts with ${process.env.INDIANAPI_KEY.slice(0, 4)}...)`
    : "❌ MISSING",
);
console.log("─────────────────────────────���───────────────");

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

// Routes imports
const authRoutes = require("./routes/authRoutes");
const holdingRoutes = require("./routes/holdingRoutes");
const positionRoutes = require("./routes/positionRoutes");
const orderRoutes = require("./routes/orderRoutes");
const marketRoutes = require("./routes/marketRoutes");
const companyRoutes = require("./routes/companyRoutes");
const walletRoutes = require("./routes/walletRoutes");
const watchlistRoutes = require("./routes/watchlistRoutes");

// Service imports — loaded AFTER routes to avoid circular dependency
const instrumentMapService = require("./services/instrumentMapService");
const marketQuoteService = require("./services/marketQuoteService");

const app = express();
const PORT = process.env.PORT || 3002;
const url = process.env.MONGO_URL;

// Trust proxy
app.set("trust proxy", 1);

// Security headers
app.use(helmet());

// CORS setup
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://tradewell-marketing.vercel.app",
  "https://tradewell-dashboard.vercel.app",
].filter(Boolean);

console.log("[BOOT] CORS allowed origins:", allowedOrigins);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      console.warn("[CORS] Blocked request from disallowed origin:", origin);
      return callback(new Error("Origin not allowed by CORS"));
    },
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Sanitize inputs
function sanitizeInPlace(obj) {
  if (!obj || typeof obj !== "object") return;
  for (const key of Object.keys(obj)) {
    if (key.startsWith("$") || key.includes(".")) {
      delete obj[key];
      continue;
    }
    if (obj[key] && typeof obj[key] === "object") {
      sanitizeInPlace(obj[key]);
    }
  }
}

app.use((req, res, next) => {
  sanitizeInPlace(req.body);
  sanitizeInPlace(req.params);
  sanitizeInPlace(req.query);
  next();
});

// Global rate limiter
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

// Auth rate limiter
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts. Please try again in a few minutes." },
});
app.use(["/login", "/signup", "/change-password"], authLimiter);

// Request logging
app.use((req, res, next) => {
  console.log(
    `\n[${new Date().toLocaleTimeString()}] ${req.method} ${req.path}`,
    "| Origin:",
    req.headers.origin || "(none)",
    "| Auth cookie present:",
    !!req.cookies?.token,
  );
  next();
});

// Routes
app.use("/", authRoutes);
app.use("/", holdingRoutes);
app.use("/", positionRoutes);
app.use("/", orderRoutes);
app.use("/", walletRoutes);
app.use("/", marketRoutes);
app.use("/market", companyRoutes);
app.use("/", watchlistRoutes);

// 404 handler
app.use((req, res) => {
  console.warn(`[404] No route matched: ${req.method} ${req.path}`);
  res.status(404).json({ message: `Route ${req.method} ${req.path} not found.` });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("[UNCAUGHT ERROR]", err.stack || err.message);
  if (res.headersSent) return next(err);
  res.status(err.statusCode || 500).json({ message: "Something went wrong. Please try again." });
});

// ── CONNECT DB THEN START SERVER ──────────────────────────────────────────

async function startServer() {
  // Validate required env vars
  if (!url) {
    console.error("❌ MONGO_URL is missing from .env — cannot start server.");
    process.exit(1);
  }
  if (!process.env.JWT_SECRET) {
    console.error("❌ JWT_SECRET is missing from .env — cannot start server.");
    process.exit(1);
  }
  if (allowedOrigins.length === 0) {
    console.warn("⚠️  No FRONTEND_URL/DASHBOARD_URL set — cross-origin requests will be BLOCKED.");
  }
  if (!process.env.INDIANAPI_KEY) {
    console.warn("⚠️  INDIANAPI_KEY is missing from .env — /market/company/:symbol requests will fail.");
  }

  try {
    // 1. Connect to MongoDB
    await mongoose.connect(url);
    console.log("✅ DB Connected");

    // 2. Load instrument map FIRST (await it completes)
    console.log("[BOOT] Loading instrument map...");
    await instrumentMapService.refreshInstrumentMap();
    console.log("[BOOT] ✅ Instrument map loaded");

    // 3. Schedule periodic refresh
    instrumentMapService.scheduleInstrumentRefresh();

    // 4. Start the HTTP server
    app.listen(PORT, () => {
      console.log(`✅ Backend running on http://localhost:${PORT}`);
      console.log("─────────────────────────────────────────────\n");
    });

    // 5. Start market polling AFTER server is up (with slight delay)
    setTimeout(() => {
      console.log("[BOOT] Starting market polling...");
      marketQuoteService.startPolling();
    }, 4000);
  } catch (err) {
    console.error("❌ Server startup failed:", err.message);
    console.error("Check your MONGO_URL in .env file.");
    process.exit(1);
  }
}

// Start everything
startServer();