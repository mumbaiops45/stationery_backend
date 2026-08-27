const streamModule = require("stream");

const {
  cloudinary,
  isCloudinaryConfigured,
  CLOUDINARY_ROOT_FOLDER,
} = require("../config/cloudinary");

// ======================================================
// SHARED UPLOAD OPTIONS
//
// Cap the stored asset so a 12MP phone photo does not
// become a 5MB product thumbnail, and let Cloudinary
// pick the compression level.
// ======================================================

const baseUploadOptions = (
  folder
) => ({
  folder: folder
    ? `${CLOUDINARY_ROOT_FOLDER}/${folder}`
    : CLOUDINARY_ROOT_FOLDER,

  resource_type: "image",

  transformation: [
    {
      width: 1600,
      height: 1600,
      crop: "limit",
    },
    {
      quality: "auto:good",
    },
  ],
});

const assertConfigured = () => {
  if (!isCloudinaryConfigured) {
    const error = new Error(
      "Image storage is not configured. Set the CLOUDINARY_* environment variables."
    );

    error.statusCode = 503;

    throw error;
  }
};

// ======================================================
// UPLOAD A BUFFER (multipart/form-data uploads)
// ======================================================

const uploadBuffer = (
  buffer,
  folder
) => {
  assertConfigured();

  return new Promise(
    (resolve, reject) => {
      const uploadStream =
        cloudinary.uploader.upload_stream(
          baseUploadOptions(
            folder
          ),
          (error, result) => {
            if (error) {
              return reject(
                error
              );
            }

            resolve({
              url: result.secure_url,
              publicId:
                result.public_id,
            });
          }
        );

      streamModule.Readable.from(
        buffer
      ).pipe(uploadStream);
    }
  );
};

// ======================================================
// UPLOAD A BASE64 DATA URL
//
// The admin panel currently posts images inline as
// "data:image/jpeg;base64,...". Uploading them here keeps
// that client working unchanged while the blob stops
// being written to MongoDB.
// ======================================================

const uploadDataUrl = async (
  dataUrl,
  folder
) => {
  assertConfigured();

  const result =
    await cloudinary.uploader.upload(
      dataUrl,
      baseUploadOptions(folder)
    );

  return {
    url: result.secure_url,
    publicId: result.public_id,
  };
};

// ======================================================
// DELETE AN ASSET
//
// Never throws: losing an orphaned Cloudinary file must
// not fail the product update that triggered it.
// ======================================================

const destroyImage = async (
  publicId
) => {
  if (
    !publicId ||
    !isCloudinaryConfigured
  ) {
    return false;
  }

  try {
    await cloudinary.uploader.destroy(
      publicId
    );

    return true;
  } catch (error) {
    console.error(
      `Failed to delete Cloudinary asset ${publicId}:`,
      error.message
    );

    return false;
  }
};

const isDataUrl = (value) =>
  typeof value === "string" &&
  value.startsWith("data:");

// ======================================================
// RESOLVE AN INCOMING image FIELD
//
// Accepts whatever the client sent and returns the shape
// that should be persisted:
//
//   undefined            -> null  (field absent, no change)
//   { url: "" }          -> clear the image
//   { url: "data:..." }  -> upload to Cloudinary
//   { url: "https://" }  -> already hosted, store as-is
// ======================================================

const resolveImageInput = async (
  image,
  folder
) => {
  if (image === undefined) {
    return null;
  }

  const url =
    typeof image === "string"
      ? image
      : image?.url || "";

  if (!url) {
    return {
      url: "",
      publicId: "",
    };
  }

  if (isDataUrl(url)) {
    return uploadDataUrl(
      url,
      folder
    );
  }

  // Already a hosted URL. Keep the publicId if the client
  // round-tripped it, so we can still clean it up later.
  return {
    url: url.trim(),
    publicId:
      (typeof image ===
      "object"
        ? image?.publicId
        : "") || "",
  };
};

module.exports = {
  uploadBuffer,
  uploadDataUrl,
  destroyImage,
  resolveImageInput,
  isDataUrl,
};
