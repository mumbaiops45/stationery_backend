const Category = require("../models/Category");

// ======================================================
// GET ALL ACTIVE CATEGORIES
// ======================================================

const getCategories = async (
  req,
  res,
  next
) => {
  try {
    const categories =
      await Category.find({
        isActive: true,
      })
        .sort({ name: 1 })
        .lean();

    return res.status(200).json({
      success: true,
      data: {
        categories,
      },
    });
  } catch (error) {
    next(error);
  }
};


// ======================================================
// GET ALL CATEGORIES - ADMIN
// Search + Status + Sort + Pagination
// ======================================================

const getAdminCategories = async (
  req,
  res,
  next
) => {
  try {
    const {
      search = "",
      status = "all",
      sort = "name_asc",
      page = 1,
      limit = 10,
    } = req.query;

    // --------------------------------------------------
    // PAGINATION
    // --------------------------------------------------

    const currentPage = Math.max(
      Number(page) || 1,
      1
    );

    const perPage = Math.min(
      Math.max(Number(limit) || 10, 1),
      100
    );

    const skip =
      (currentPage - 1) * perPage;

    // --------------------------------------------------
    // FILTER
    // --------------------------------------------------

    const filter = {};

    // Status
    if (status === "active") {
      filter.isActive = true;
    }

    if (status === "inactive") {
      filter.isActive = false;
    }

    // Search by category name
    if (search.trim()) {
      filter.name = {
        $regex: search.trim(),
        $options: "i",
      };
    }

    // --------------------------------------------------
    // SORT
    // --------------------------------------------------

    let sortOption = {
      name: 1,
    };

    switch (sort) {
      case "name_desc":
        sortOption = {
          name: -1,
        };
        break;

      case "newest":
        sortOption = {
          createdAt: -1,
        };
        break;

      case "oldest":
        sortOption = {
          createdAt: 1,
        };
        break;

      case "name_asc":
      default:
        sortOption = {
          name: 1,
        };
        break;
    }

    // --------------------------------------------------
    // DATABASE QUERY
    // --------------------------------------------------

    const [
      categories,
      totalCategories,
    ] = await Promise.all([
      Category.find(filter)
        .sort(sortOption)
        .skip(skip)
        .limit(perPage)
        .lean(),

      Category.countDocuments(filter),
    ]);

    // --------------------------------------------------
    // RESPONSE
    // --------------------------------------------------

    return res.status(200).json({
      success: true,

      data: {
        categories,

        pagination: {
          page: currentPage,
          limit: perPage,
          totalCategories,
          totalPages: Math.ceil(
            totalCategories / perPage
          ),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ======================================================
// GET CATEGORY BY ID
// ======================================================

const getCategoryById = async (
  req,
  res,
  next
) => {
  try {
    const category =
      await Category.findOne({
        _id: req.params.id,
        isActive: true,
      }).lean();

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        category,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ======================================================
// GET CATEGORY BY SLUG
// ======================================================

const getCategoryBySlug = async (
  req,
  res,
  next
) => {
  try {
    const category =
      await Category.findOne({
        slug: req.params.slug,
        isActive: true,
      }).lean();

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        category,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ======================================================
// CREATE CATEGORY - ADMIN
// ======================================================

const createCategory = async (
  req,
  res,
  next
) => {
  try {
    const {
      name,
      slug,
      description,
      image,
    } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Category name is required",
      });
    }

    const generatedSlug =
      slug ||
      name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

    const existingCategory =
      await Category.findOne({
        $or: [
          {
            name: name.trim(),
          },
          {
            slug: generatedSlug,
          },
        ],
      });

    if (existingCategory) {
      return res.status(409).json({
        success: false,
        message:
          "Category with this name or slug already exists",
      });
    }

    const category =
      await Category.create({
        name: name.trim(),
        slug: generatedSlug,
        description:
          description || "",
        image: {
          url:
            image?.url || "",
        },
      });

    return res.status(201).json({
      success: true,
      message:
        "Category created successfully",
      data: {
        category,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ======================================================
// UPDATE CATEGORY - ADMIN
// ======================================================

const updateCategory = async (
  req,
  res,
  next
) => {
  try {
    const category =
      await Category.findById(
        req.params.id
      );

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    const {
      name,
      slug,
      description,
      image,
    } = req.body;

    if (name !== undefined) {
      category.name =
        name.trim();
    }

    if (slug !== undefined) {
      category.slug =
        slug
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
    }

    if (description !== undefined) {
      category.description =
        description.trim();
    }

    if (image !== undefined) {
      category.image = {
        url:
          image?.url || "",
      };
    }

    await category.save();

    return res.status(200).json({
      success: true,
      message:
        "Category updated successfully",
      data: {
        category,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ======================================================
// UPDATE CATEGORY STATUS - ADMIN
// ======================================================

const updateCategoryStatus = async (
  req,
  res,
  next
) => {
  try {
    const { isActive } =
      req.body;

    if (
      typeof isActive !== "boolean"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "isActive must be true or false",
      });
    }

    const category =
      await Category.findByIdAndUpdate(
        req.params.id,
        {
          isActive,
        },
        {
          new: true,
          runValidators: true,
        }
      );

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "Category status updated successfully",
      data: {
        category,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ======================================================
// DELETE CATEGORY - ADMIN
// ======================================================

const deleteCategory = async (
  req,
  res,
  next
) => {
  try {
    const category =
      await Category.findById(
        req.params.id
      );

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Soft delete
    category.isActive = false;

    await category.save();

    return res.status(200).json({
      success: true,
      message:
        "Category deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCategories,
  getAdminCategories,
  getCategoryById,
  getCategoryBySlug,
  createCategory,
  updateCategory,
  updateCategoryStatus,
  deleteCategory,
};