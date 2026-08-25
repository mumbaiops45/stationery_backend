const {
  verifyAccessToken,
} = require("../utils/jwt");

// ======================================================
// PROTECT AUTHENTICATED ROUTES
// ======================================================

const protect = (
  req,
  res,
  next
) => {
  try {
    const authorization =
      req.headers.authorization;

    if (!authorization) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication required",
      });
    }

    const [scheme, token] =
      authorization.split(" ");

    if (
      scheme !== "Bearer" ||
      !token
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid authorization format",
      });
    }

    const decoded =
      verifyAccessToken(token);

    req.user = decoded;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message:
        "Invalid or expired access token",
    });
  }
};

// ======================================================
// ADMIN ONLY
// ======================================================

const adminOnly = (
  req,
  res,
  next
) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message:
        "Authentication required",
    });
  }

  if (
    req.user.role !== "admin"
  ) {
    return res.status(403).json({
      success: false,
      message:
        "Admin access required",
    });
  }

  next();
};

module.exports = {
  protect,
  adminOnly,
};