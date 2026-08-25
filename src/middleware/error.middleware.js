const errorHandler = (
  err,
  req,
  res,
  next
) => {
  console.error(err);

  // Duplicate field
  if (err.code === 11000) {
    const field =
      Object.keys(
        err.keyPattern || {}
      )[0];

    return res.status(409).json({
      success: false,
      message:
        `${field || "Field"} already exists`,
    });
  }

  // Mongoose validation
  if (
    err.name ===
    "ValidationError"
  ) {
    const messages =
      Object.values(
        err.errors
      ).map(
        (error) =>
          error.message
      );

    return res.status(400).json({
      success: false,
      message:
        "Validation failed",
      errors: messages,
    });
  }

  return res.status(
    err.statusCode || 500
  ).json({
    success: false,
    message:
      err.message ||
      "Internal server error",
  });
};

module.exports = errorHandler;