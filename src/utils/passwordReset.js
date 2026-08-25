const crypto = require("crypto");

const generateResetToken = () => {
  return crypto.randomBytes(32).toString("hex");
};

const hashResetToken = (token) => {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
};

module.exports = {
  generateResetToken,
  hashResetToken,
};