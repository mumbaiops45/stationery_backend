const crypto = require("crypto");

const generateRefreshToken = () => {
  return crypto.randomBytes(64).toString("hex");
};

const hashRefreshToken = (token) => {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
};

const generateFamilyId = () => {
  return crypto.randomUUID();
};

module.exports = {
  generateRefreshToken,
  hashRefreshToken,
  generateFamilyId,
};