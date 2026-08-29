// ══════════════════════════════════════════════════════════════════════
// CSRF GUARD - Why this exists:
//
// Production cookies use `sameSite: "none"` (see issueAuthCookie.js),
// which is required because the frontend (Vercel) and backend (Render)
// are on different domains. CORS governs whether a malicious site's JS
// can READ your API's response — but it does NOT stop a malicious site
// from SENDING a request with your cookie attached in the first place.
// A plain <form method="POST"> on an attacker's page can still submit
// to e.g. /logout, /update-profile, /wallet/reset, or /newOrder with the
// browser auto-attaching your session cookie, and CORS never even enters
// the picture for a simple form submission (no preflight, no JS
// involved).
//
// A plain HTML <form> CANNOT set a custom request header — only
// JavaScript's fetch/XHR can. So requiring a lightweight custom header
// on every state-changing request is enough to block the "attacker's
// HTML form" version of CSRF across the whole API. This is NOT a full
// CSRF-token system, but it covers the realistic risk here for a low
// additional cost.
//
// APPLIED GLOBALLY (see app.js) rather than per-route: this used to be
// wired onto three specific routes in authRoutes.js by hand, which meant
// every OTHER state-changing route added later (e.g. /wallet/reset,
// /newOrder, DELETE /watchlist/list/:id) had no protection unless
// someone remembered to add this middleware to that specific route too.
// Applying it once, globally, to every non-GET request closes that gap
// for the whole app at once and can't be forgotten on a future route.
//
// GET/HEAD/OPTIONS are exempt — those don't change state, and OPTIONS in
// particular is the CORS preflight request, which never carries custom
// headers by design and must be allowed through untouched.
//
// The frontend must send this header on every request. Both frontend
// repos already do this by default — see api.js (dashboard) and
// axiosInstance.js (marketing/auth) — so no per-call changes are needed
// there; this was a backend-only gap.
// ══════════════════════════════════════════════════════════════════════

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function csrfGuard(req, res, next) {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  const header = req.headers["x-requested-with"];

  if (header !== "XMLHttpRequest") {
    console.warn(
      `[CSRF-GUARD] Blocked request missing x-requested-with header: ${req.method} ${req.path}`,
    );
    return res.status(403).json({
      message: "Request blocked. Please use the Tradewell app to perform this action.",
    });
  }

  next();
}

module.exports = { csrfGuard };