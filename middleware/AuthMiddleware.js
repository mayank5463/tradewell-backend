


const jwt = require("jsonwebtoken");

function AuthMiddleware(req, res, next) {
  const token = req.cookies?.token;

  if (!token) {
    console.warn("[AUTH-MIDDLEWARE] No token found");
    return res.status(401).json({ 
      isAuthenticated: false,
      message: "Authentication required. Please login." 
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
    });

    // FIX: Change decoded.userId to decoded.id
    req.user = {
      id: decoded.id, // ← CHANGED THIS LINE (was decoded.userId)
      email: decoded.email,
      name: decoded.name,
    };

    next();
  } catch (err) {
    console.error("[AUTH-MIDDLEWARE] Token verification failed:", err.message);
    
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      path: "/",
      expires: new Date(0),
    });

    return res.status(401).json({ 
      isAuthenticated: false,
      message: "Session expired. Please login again." 
    });
  }
}

module.exports = { AuthMiddleware };