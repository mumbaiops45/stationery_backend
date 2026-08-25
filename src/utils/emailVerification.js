const crypto = require("crypto");

const generateVerificationToken = () => {
  return crypto.randomBytes(32).toString("hex");
};

const hashVerificationToken = (token) => {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
};

module.exports = {
  generateVerificationToken,
  hashVerificationToken,
};