const {
  uploadBuffer,
  destroyImage,
} = require("../utils/cloudinaryUpload");

// ======================================================
// UPLOAD AN IMAGE - ADMIN
//
// POST /api/uploads/image
// multipart/form-data, field name: "image"
// optional field: "folder" (products | categories)
// ======================================================

const ALLOWED_FOLDERS = [
  "products",
  "categories",
  "variants",
  "misc",
];

const uploadImage = async (
  req,
  res,
  next
) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message:
          "No image file received. Send the file in the 'image' field.",
      });
    }

    const requestedFolder =
      (req.body?.folder || "misc")
        .toString()
        .trim();

    const folder =
      ALLOWED_FOLDERS.includes(
        requestedFolder
      )
        ? requestedFolder
        : "misc";

    const image =
      await uploadBuffer(
        req.file.buffer,
        folder
      );

    return res.status(201).json({
      success: true,
      message:
        "Image uploaded successfully",
      data: {
        image,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ======================================================
// DELETE AN IMAGE - ADMIN
//
// DELETE /api/uploads/image
// body: { publicId }
//
// publicId contains slashes, so it is taken from the body
// rather than a route param.
// ======================================================

const deleteImage = async (
  req,
  res,
  next
) => {
  try {
    const { publicId } =
      req.body;

    if (!publicId) {
      return res.status(400).json({
        success: false,
        message:
          "publicId is required",
      });
    }

    const deleted =
      await destroyImage(
        publicId
      );

    return res.status(200).json({
      success: true,
      message: deleted
        ? "Image deleted successfully"
        : "Image could not be deleted or no longer exists",
      data: {
        deleted,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadImage,
  deleteImage,
};
