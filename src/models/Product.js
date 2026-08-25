const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      minlength: [
        2,
        "Product name must be at least 2 characters",
      ],
      maxlength: [
        200,
        "Product name cannot exceed 200 characters",
      ],
      index: true,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    description: {
      type: String,
      required: [
        true,
        "Product description is required",
      ],
      trim: true,
      maxlength: [
        5000,
        "Description cannot exceed 5000 characters",
      ],
    },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Category is required"],
      index: true,
    },

    price: {
      type: Number,
      required: [true, "Product price is required"],
      min: [0, "Price cannot be negative"],
    },

    compareAtPrice: {
      type: Number,
      default: null,
      min: [0, "Compare price cannot be negative"],
    },

    image: {
      url: {
        type: String,
        default: "",
        trim: true,
      },
    },

    stock: {
      type: Number,
      default: 0,
      min: [0, "Stock cannot be negative"],
    },

    hasVariants: {
      type: Boolean,
      default: false,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "Product",
  productSchema
);