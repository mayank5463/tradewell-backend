const jwt = require("jsonwebtoken");

function issueAuthCookie(res, user) {
  console.log("[AUTH] Signing JWT for user:", user.email);

  const token = jwt.sign(
    { id: user._id, email: user.email, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: "7d" },
  );

  const isProd = process.env.NODE_ENV === "production";

  // In prod (real HTTPS, cross-site frontend) we need secure+none.
  // In local dev (http://localhost) secure:true silently kills the cookie —
  // browsers refuse to store Secure cookies over plain HTTP — which is why
  // auth (and everything gated behind it: holdings/orders/funds) looked
  // like it was "resetting on refresh." It wasn't resetting — it was
  // never authenticated in the first place.
  res.cookie("token", token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  console.log("[AUTH] Cookie 'token' set on response for:", user.email);
  return token;
}

module.exports = { issueAuthCookie };