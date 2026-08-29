const jwt = require("jsonwebtoken");

function issueAuthCookie(res, user) {
  console.log("[AUTH] Signing JWT for user:", user.email);

  // Use 'id' as the key (matches AuthMiddleware expectation)
  const token = jwt.sign(
    { 
      id: user._id,        // ← This is the key AuthMiddleware looks for
      email: user.email, 
      name: user.name 
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" },
  );

  const isProd = process.env.NODE_ENV === "production";

  res.cookie("token", token, {
    httpOnly: true,
    secure: isProd,        // false in development (allows HTTP)
    sameSite: isProd ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });

  console.log("[AUTH] Cookie 'token' set for:", user.email);
  return token;
}

module.exports = { issueAuthCookie };