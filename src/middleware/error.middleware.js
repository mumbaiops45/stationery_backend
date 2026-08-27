const errorHandler = (
  err,
  req,
  res,
  next
) => {
  console.error(err);

  // Payload too large (body-parser). The raw message is just
  // "request entity too large", which tells the client nothing actionable.
  if (
    err.type ===
      "entity.too.large" ||
    err.statusCode === 413
  ) {
    return res.status(413).json({
      success: false,
      message:
        "Upload is too large. Please use a smaller image.",
    });
  }

  // Multer upload errors
  if (
    err.name === "MulterError"
  ) {
    const messages = {
      LIMIT_FILE_SIZE:
        "Image is too large. Maximum size is 5MB.",
      LIMIT_FILE_COUNT:
        "Only one image can be uploaded at a time.",
      LIMIT_UNEXPECTED_FILE:
        "Unexpected file field. Send the image in the 'image' field.",
    };

    return res.status(400).json({
      success: false,
      message:
        messages[err.code] ||
        "Image upload failed",
    });
  }

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