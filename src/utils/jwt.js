const jwt = require("jsonwebtoken");

const generateAccessToken = (user) => {
  return jwt.sign(
    {
      userId: user._id.toString(),
      role: user.role,
    },
    process.env.JWT_ACCESS_SECRET,
    {
      expiresIn:
        process.env.ACCESS_TOKEN_EXPIRES_IN || "3h",
    }
  );
};

const verifyAccessToken = (token) => {
  return jwt.verify(
    token,
    process.env.JWT_ACCESS_SECRET
  );
};

module.exports = {
  generateAccessToken,
  verifyAccessToken,
};