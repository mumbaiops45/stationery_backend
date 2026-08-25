const mongoose = require("mongoose");
const Product = require("../models/Product");
const Category = require("../models/Category");

// ======================================================
// HELPER - CREATE SLUG
// ======================================================

const createSlug = (value) => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
};

// ======================================================
// GET PRODUCTS
// SEARCH + FILTER + SORT + PAGINATION
// ======================================================

const getProducts = async (
  req,
  res,
  next
) => {
  try {
    const {
      search,
      category,
      minPrice,
      maxPrice,
      inStock,
      sort = "newest",
      page = 1,
      limit = 20,
    } = req.query;

    // --------------------------------------------------
    // PAGINATION
    // --------------------------------------------------

    const currentPage = Math.max(
      Number(page) || 1,
      1
    );

    const perPage = Math.min(
      Math.max(Number(limit) || 20, 1),
      100
    );

    // --------------------------------------------------
    // FILTER
    // --------------------------------------------------

    const filter = {
      isActive: true,
    };

    // Search
    if (search) {
      filter.$or = [
        {
          name: {
            $regex: search.trim(),
            $options: "i",
          },
        },
        {
          description: {
            $regex: search.trim(),
            $options: "i",
          },
        },
      ];
    }

    // Category
    if (category) {
      if (
        mongoose.Types.ObjectId.isValid(
          category
        )
      ) {
        filter.category = category;
      } else {
        const categoryDoc =
          await Category.findOne({
            slug: category
              .trim()
              .toLowerCase(),
            isActive: true,
          });

        if (!categoryDoc) {
          return res.status(200).json({
            success: true,
            data: {
              products: [],
              pagination: {
                page: currentPage,
                limit: perPage,
                totalProducts: 0,
                totalPages: 0,
                hasNextPage: false,
                hasPreviousPage:
                  false,
              },
            },
          });
        }

        filter.category =
          categoryDoc._id;
      }
    }

    // Minimum price
    if (minPrice !== undefined) {
      const minimum =
        Number(minPrice);

      if (
        Number.isNaN(minimum) ||
        minimum < 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid minimum price",
        });
      }

      filter.price = {
        ...(filter.price || {}),
        $gte: minimum,
      };
    }

    // Maximum price
    if (maxPrice !== undefined) {
      const maximum =
        Number(maxPrice);

      if (
        Number.isNaN(maximum) ||
        maximum < 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid maximum price",
        });
      }

      filter.price = {
        ...(filter.price || {}),
        $lte: maximum,
      };
    }

    // Stock filter
    if (inStock === "true") {
      filter.stock = {
        $gt: 0,
      };
    }

    if (inStock === "false") {
      filter.stock = {
        $lte: 0,
      };
    }

    // --------------------------------------------------
    // SORT
    // --------------------------------------------------

    let sortOption = {
      createdAt: -1,
    };

    switch (sort) {
      case "price_asc":
        sortOption = {
          price: 1,
        };
        break;

      case "price_desc":
        sortOption = {
          price: -1,
        };
        break;

      case "name_asc":
        sortOption = {
          name: 1,
        };
        break;

      case "name_desc":
        sortOption = {
          name: -1,
        };
        break;

      case "oldest":
        sortOption = {
          createdAt: 1,
        };
        break;

      case "newest":
      default:
        sortOption = {
          createdAt: -1,
        };
        break;
    }

    // --------------------------------------------------
    // TOTAL
    // --------------------------------------------------

    const totalProducts =
      await Product.countDocuments(
        filter
      );

    const totalPages =
      Math.ceil(
        totalProducts / perPage
      );

    const skip =
      (currentPage - 1) *
      perPage;

    // --------------------------------------------------
    // GET PRODUCTS
    // --------------------------------------------------

    const products =
      await Product.find(filter)
        .populate(
          "category",
          "name slug"
        )
        .sort(sortOption)
        .skip(skip)
        .limit(perPage)
        .lean();

    return res.status(200).json({
      success: true,
      data: {
        products,
        pagination: {
          page: currentPage,
          limit: perPage,
          totalProducts,
          totalPages,
          hasNextPage:
            currentPage <
            totalPages,
          hasPreviousPage:
            currentPage > 1,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ======================================================
// GET PRODUCT BY ID
// ======================================================

const getProductById = async (
  req,
  res,
  next
) => {
  try {
    const { id } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(
        id
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const product =
      await Product.findOne({
        _id: id,
        isActive: true,
      })
        .populate(
          "category",
          "name slug"
        )
        .lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        product,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ======================================================
// GET PRODUCT BY SLUG
// ======================================================

const getProductBySlug = async (
  req,
  res,
  next
) => {
  try {
    const product =
      await Product.findOne({
        slug: req.params.slug,
        isActive: true,
      })
        .populate(
          "category",
          "name slug"
        )
        .lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        product,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ======================================================
// CREATE PRODUCT - ADMIN
// ======================================================

const createProduct = async (
  req,
  res,
  next
) => {
  try {
    const {
      name,
      slug,
      description,
      category,
      price,
      compareAtPrice,
      image,
      stock,
      hasVariants,
    } = req.body;

    // --------------------------------------------------
    // REQUIRED FIELDS
    // --------------------------------------------------

    if (
      !name ||
      !description ||
      !category ||
      price === undefined
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Name, description, category and price are required",
      });
    }

    // --------------------------------------------------
    // VALIDATE CATEGORY
    // --------------------------------------------------

    if (
      !mongoose.Types.ObjectId.isValid(
        category
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid category ID",
      });
    }

    const categoryDoc =
      await Category.findOne({
        _id: category,
        isActive: true,
      });

    if (!categoryDoc) {
      return res.status(400).json({
        success: false,
        message:
          "Category not found or inactive",
      });
    }

    // --------------------------------------------------
    // PRICE VALIDATION
    // --------------------------------------------------

    const productPrice =
      Number(price);

    if (
      Number.isNaN(productPrice) ||
      productPrice < 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid product price",
      });
    }

    if (
      compareAtPrice !== undefined &&
      compareAtPrice !== null
    ) {
      const comparePrice =
        Number(compareAtPrice);

      if (
        Number.isNaN(comparePrice) ||
        comparePrice < 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid compare price",
        });
      }

      if (
        comparePrice <
        productPrice
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Compare price should be greater than or equal to selling price",
        });
      }
    }

    // --------------------------------------------------
    // SLUG
    // --------------------------------------------------

    const generatedSlug =
      slug
        ? createSlug(slug)
        : createSlug(name);

    const existingProduct =
      await Product.findOne({
        slug: generatedSlug,
      });

    if (existingProduct) {
      return res.status(409).json({
        success: false,
        message:
          "A product with this slug already exists",
      });
    }

    // --------------------------------------------------
    // STOCK
    // --------------------------------------------------

    const productStock =
      stock === undefined
        ? 0
        : Number(stock);

    if (
      Number.isNaN(productStock) ||
      productStock < 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid stock value",
      });
    }

    // --------------------------------------------------
    // CREATE
    // --------------------------------------------------

    const product =
      await Product.create({
        name: name.trim(),
        slug: generatedSlug,
        description:
          description.trim(),
        category,
        price: productPrice,
        compareAtPrice:
          compareAtPrice === undefined ||
          compareAtPrice === null
            ? null
            : Number(compareAtPrice),

        image: {
          url:
            image?.url || "",
        },

        stock: productStock,

        hasVariants:
          hasVariants === true,
      });

    const populatedProduct =
      await Product.findById(
        product._id
      )
        .populate(
          "category",
          "name slug"
        )
        .lean();

    return res.status(201).json({
      success: true,
      message:
        "Product created successfully",
      data: {
        product:
          populatedProduct,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ======================================================
// UPDATE PRODUCT - ADMIN
// ======================================================

const updateProduct = async (
  req,
  res,
  next
) => {
  try {
    const { id } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(
        id
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const product =
      await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const {
      name,
      slug,
      description,
      category,
      price,
      compareAtPrice,
      image,
      stock,
      hasVariants,
    } = req.body;

    // Name
    if (name !== undefined) {
      const trimmedName =
        name.trim();

      if (
        trimmedName.length < 2
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Product name must be at least 2 characters",
        });
      }

      product.name =
        trimmedName;
    }

    // Slug
    if (slug !== undefined) {
      product.slug =
        createSlug(slug);
    }

    // Description
    if (
      description !== undefined
    ) {
      product.description =
        description.trim();
    }

    // Category
    if (category !== undefined) {
      if (
        !mongoose.Types.ObjectId.isValid(
          category
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid category ID",
        });
      }

      const categoryDoc =
        await Category.findOne({
          _id: category,
          isActive: true,
        });

      if (!categoryDoc) {
        return res.status(400).json({
          success: false,
          message:
            "Category not found or inactive",
        });
      }

      product.category =
        category;
    }

    // Price
    if (price !== undefined) {
      const productPrice =
        Number(price);

      if (
        Number.isNaN(productPrice) ||
        productPrice < 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid product price",
        });
      }

      product.price =
        productPrice;
    }

    // Compare price
    if (
      compareAtPrice !== undefined
    ) {
      if (
        compareAtPrice === null
      ) {
        product.compareAtPrice =
          null;
      } else {
        const comparePrice =
          Number(compareAtPrice);

        if (
          Number.isNaN(
            comparePrice
          ) ||
          comparePrice < 0
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid compare price",
          });
        }

        product.compareAtPrice =
          comparePrice;
      }
    }

    // Image
    if (image !== undefined) {
      product.image = {
        url:
          image?.url || "",
      };
    }

    // Stock
    if (stock !== undefined) {
      const productStock =
        Number(stock);

      if (
        Number.isNaN(productStock) ||
        productStock < 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid stock value",
        });
      }

      product.stock =
        productStock;
    }

    // Variants
    if (
      hasVariants !== undefined
    ) {
      product.hasVariants =
        Boolean(hasVariants);
    }

    await product.save();

    const updatedProduct =
      await Product.findById(
        product._id
      )
        .populate(
          "category",
          "name slug"
        )
        .lean();

    return res.status(200).json({
      success: true,
      message:
        "Product updated successfully",
      data: {
        product:
          updatedProduct,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ======================================================
// UPDATE PRODUCT STATUS - ADMIN
// ======================================================

const updateProductStatus =
  async (
    req,
    res,
    next
  ) => {
    try {
      const { isActive } =
        req.body;

      if (
        typeof isActive !==
        "boolean"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "isActive must be true or false",
        });
      }

      const product =
        await Product.findByIdAndUpdate(
          req.params.id,
          {
            isActive,
          },
          {
            new: true,
            runValidators: true,
          }
        )
          .populate(
            "category",
            "name slug"
          );

      if (!product) {
        return res.status(404).json({
          success: false,
          message:
            "Product not found",
        });
      }

      return res.status(200).json({
        success: true,
        message:
          "Product status updated successfully",
        data: {
          product,
        },
      });
    } catch (error) {
      next(error);
    }
  };

// ======================================================
// DELETE PRODUCT - ADMIN
// ======================================================

const deleteProduct = async (
  req,
  res,
  next
) => {
  try {
    const product =
      await Product.findById(
        req.params.id
      );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Soft delete
    product.isActive = false;

    await product.save();

    return res.status(200).json({
      success: true,
      message:
        "Product deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// ======================================================
// ADMIN - GET ALL PRODUCTS
// ======================================================

const getAdminProducts = async (
  req,
  res,
  next
) => {
  try {
    const {
      search,
      category,
      isActive,
      page = 1,
      limit = 20,
    } = req.query;

    const currentPage = Math.max(
      Number(page) || 1,
      1
    );

    const perPage = Math.min(
      Math.max(
        Number(limit) || 20,
        1
      ),
      100
    );

    const filter = {};

    if (search) {
      filter.$or = [
        {
          name: {
            $regex:
              search.trim(),
            $options: "i",
          },
        },
        {
          description: {
            $regex:
              search.trim(),
            $options: "i",
          },
        },
      ];
    }

    if (category) {
      if (
        mongoose.Types.ObjectId.isValid(
          category
        )
      ) {
        filter.category =
          category;
      }
    }

    if (
      isActive !== undefined
    ) {
      filter.isActive =
        isActive === "true";
    }

    const totalProducts =
      await Product.countDocuments(
        filter
      );

    const totalPages =
      Math.ceil(
        totalProducts / perPage
      );

    const products =
      await Product.find(filter)
        .populate(
          "category",
          "name slug"
        )
        .sort({
          createdAt: -1,
        })
        .skip(
          (currentPage - 1) *
            perPage
        )
        .limit(perPage)
        .lean();

    return res.status(200).json({
      success: true,
      data: {
        products,
        pagination: {
          page: currentPage,
          limit: perPage,
          totalProducts,
          totalPages,
          hasNextPage:
            currentPage <
            totalPages,
          hasPreviousPage:
            currentPage > 1,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProducts,
  getProductById,
  getProductBySlug,
  createProduct,
  updateProduct,
  updateProductStatus,
  deleteProduct,
  getAdminProducts,
};