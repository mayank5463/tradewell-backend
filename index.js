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
console.log("─────────────────────────────────────────────");

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet"); // ADDED — sets sane security headers (HSTS, no-sniff, frame-deny, etc.)
const rateLimit = require("express-rate-limit"); // ADDED

// Routes imports
const authRoutes = require("./routes/authRoutes");
const holdingRoutes = require("./routes/holdingRoutes");
const positionRoutes = require("./routes/positionRoutes");
const orderRoutes = require("./routes/orderRoutes");
const marketRoutes = require("./routes/marketRoutes");
const companyRoutes = require("./routes/companyRoutes");
const walletRoutes = require("./routes/walletRoutes"); 
const watchlistRoutes = require("./routes/watchlistRoutes");

// Upstox service imports (REST-polling architecture)
const {
  scheduleInstrumentRefresh,
} = require("./services/instrumentMapService");
const { startPolling } = require("./services/marketQuoteService");

const app = express();
const PORT = process.env.PORT || 3002;
const url = process.env.MONGO_URL;

// Trust the first proxy hop (Render/Railway/Nginx/etc.) so req.ip and
// express-rate-limit see the real client IP instead of the proxy's.
app.set("trust proxy", 1);

app.use(helmet());

// ── CORS setup ────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.DASHBOARD_URL,
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


const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);


const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts. Please try again in a few minutes." },
});
app.use(["/login", "/signup", "/change-password"], authLimiter);


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
app.use("/", authRoutes); // /signup, /login, /logout, /check-auth, /profile
app.use("/", holdingRoutes); // /allholdings
app.use("/", positionRoutes); // /allpositions
app.use("/", orderRoutes); // /allorders, /newOrder
app.use("/", walletRoutes); // /wallet, /wallet/transactions — ADDED
app.use("/", marketRoutes); // /market/quotes, /market/gainers, /market/losers, /market/indices, /market/popular, /market/status, /market/history/:symbol, /market/history/:symbol/intraday
app.use("/market", companyRoutes); // /market/company/:symbol (IndianAPI fundamentals)
app.use("/", watchlistRoutes); // /watchlist, /watchlist/list, /watchlist/active, /watchlist/list/:listId/stock

// 404 handler 
app.use((req, res) => {
  console.warn(`[404] No route matched: ${req.method} ${req.path}`);
  res
    .status(404)
    .json({ message: `Route ${req.method} ${req.path} not found.` });
});


app.use((err, req, res, next) => {
  console.error("[UNCAUGHT ERROR]", err.stack || err.message);
  if (res.headersSent) return next(err);
  res
    .status(err.statusCode || 500)
    .json({ message: "Something went wrong. Please try again." });
});

//  Connect DB then start server 
if (!url) {
  console.error("❌ MONGO_URL is missing from .env — cannot start server.");
  process.exit(1);
}
if (!process.env.JWT_SECRET) {
  console.error("❌ JWT_SECRET is missing from .env — cannot start server.");
  process.exit(1);
}
if (allowedOrigins.length === 0) {
  console.warn(
    "⚠️  No FRONTEND_URL/DASHBOARD_URL set — all cross-origin requests with credentials will be BLOCKED.",
  );
}
if (!process.env.INDIANAPI_KEY) {
  console.warn(
    "⚠️  INDIANAPI_KEY is missing from .env — /market/company/:symbol requests will fail until this is set.",
  );
}
mongoose
  .connect(url)
  .then(async () => {
    console.log("✅ DB Connected");

    const {
      refreshInstrumentMap,
      scheduleInstrumentRefresh,
    } = require("./services/instrumentMapService");
    await refreshInstrumentMap();
    scheduleInstrumentRefresh();

    app.listen(PORT, () => {
      console.log(`✅ Backend running on http://localhost:${PORT}`);
      console.log("─────────────────────────────────────────────\n");
    });

    setTimeout(() => {
      startPolling();
    }, 4000);
  })
  .catch((err) => {
    console.error("❌ DB Connection failed:", err.message);
    console.error("Check your MONGO_URL in .env file.");
    process.exit(1);
  });
