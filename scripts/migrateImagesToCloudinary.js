/**
 * One-off migration: move base64 data-URL images out of MongoDB
 * and into Cloudinary.
 *
 *   node scripts/migrateImagesToCloudinary.js --dry-run
 *   node scripts/migrateImagesToCloudinary.js
 *
 * Safe to re-run: documents whose image.url is already an https
 * URL are skipped.
 */

require("dotenv").config();

const mongoose = require("mongoose");

const Product = require("../src/models/Product");
const Category = require("../src/models/Category");

const {
  uploadDataUrl,
} = require("../src/utils/cloudinaryUpload");

const {
  isCloudinaryConfigured,
} = require("../src/config/cloudinary");

const DRY_RUN =
  process.argv.includes(
    "--dry-run"
  );

const TARGETS = [
  {
    label: "products",
    model: Product,
    folder: "products",
  },
  {
    label: "categories",
    model: Category,
    folder: "categories",
  },
];

const migrateCollection = async ({
  label,
  model,
  folder,
}) => {
  const docs = await model
    .find({
      "image.url": /^data:/,
    })
    .select("name image");

  console.log(
    `\n${label}: ${docs.length} document(s) with base64 images`
  );

  let migrated = 0;
  let failed = 0;
  let bytesFreed = 0;

  for (const doc of docs) {
    const originalLength =
      doc.image.url.length;

    if (DRY_RUN) {
      console.log(
        `  [dry-run] ${doc.name} (${(originalLength / 1024).toFixed(1)} KB)`
      );

      bytesFreed +=
        originalLength;

      migrated += 1;

      continue;
    }

    try {
      const uploaded =
        await uploadDataUrl(
          doc.image.url,
          folder
        );

      doc.image = uploaded;

      await doc.save();

      bytesFreed +=
        originalLength;

      migrated += 1;

      console.log(
        `  ok  ${doc.name} -> ${uploaded.url}`
      );
    } catch (error) {
      failed += 1;

      console.error(
        `  FAIL ${doc.name}: ${error.message}`
      );
    }
  }

  return {
    label,
    migrated,
    failed,
    bytesFreed,
  };
};

const run = async () => {
  if (!isCloudinaryConfigured) {
    console.error(
      "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, " +
        "CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in .env first."
    );

    process.exit(1);
  }

  await mongoose.connect(
    process.env.MONGO_URI
  );

  console.log(
    DRY_RUN
      ? "DRY RUN - nothing will be written"
      : "Migrating images to Cloudinary..."
  );

  const results = [];

  for (const target of TARGETS) {
    results.push(
      await migrateCollection(
        target
      )
    );
  }

  console.log("\n===== SUMMARY =====");

  let totalBytes = 0;

  for (const r of results) {
    console.log(
      `${r.label}: ${r.migrated} migrated, ${r.failed} failed`
    );

    totalBytes += r.bytesFreed;
  }

  console.log(
    `MongoDB space reclaimed: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`
  );

  await mongoose.disconnect();
};

run().catch(
  async (error) => {
    console.error(
      "Migration failed:",
      error
    );

    await mongoose.disconnect();

    process.exit(1);
  }
);
