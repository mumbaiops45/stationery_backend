const Banner = require("../models/Banner");
const {
  resolveImageInput,
  destroyImage,
} = require("../utils/cloudinaryUpload");

const BANNER_TYPES = ["homepage", "offer"];

// ======================================================
// BUILD "CURRENTLY VISIBLE" DATE FILTER
//
// A banner is visible when it has no startDate/endDate
// boundary, or the current time falls within it. This is
// what makes banners "dynamic" - admin can schedule a
// banner to go live / expire without touching code.
// ======================================================

const visibilityFilter = () => {
  const now = new Date();

  return {
    isActive: true,
    $and: [
      {
        $or: [
          { startDate: null },
          { startDate: { $lte: now } },
        ],
      },
      {
        $or: [
          { endDate: null },
          { endDate: { $gte: now } },
        ],
      },
    ],
  };
};

// ======================================================
// GET ACTIVE BANNERS - PUBLIC
// GET /api/banners?type=homepage
// GET /api/banners?type=offer
// (type omitted -> returns both kinds together)
// ======================================================

const getBanners = async (
  req,
  res,
  next
) => {
  try {
    const { type } = req.query;

    const filter =
      visibilityFilter();

    if (
      type &&
      BANNER_TYPES.includes(type)
    ) {
      filter.type = type;
    }

    const banners = await Banner.find(
      filter
    )
      .sort({
        position: 1,
        createdAt: -1,
      })
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        banners,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ======================================================
// GET ALL BANNERS - ADMIN
// Search + Type + Status + Sort + Pagination
// ======================================================

const getAdminBanners = async (
  req,
  res,
  next
) => {
  try {
    const {
      search = "",
      type = "all",
      status = "all",
      sort = "position_asc",
      page = 1,
      limit = 10,
    } = req.query;

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

    if (BANNER_TYPES.includes(type)) {
      filter.type = type;
    }

    if (status === "active") {
      filter.isActive = true;
    }

    if (status === "inactive") {
      filter.isActive = false;
    }

    if (search.trim()) {
      filter.$or = [
        {
          title: {
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

    // --------------------------------------------------
    // SORT
    // --------------------------------------------------

    let sortOption = {
      position: 1,
    };

    switch (sort) {
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

      case "position_desc":
        sortOption = {
          position: -1,
        };
        break;

      case "position_asc":
      default:
        sortOption = {
          position: 1,
        };
        break;
    }

    // --------------------------------------------------
    // DATABASE QUERY
    // --------------------------------------------------

    const [banners, totalBanners] =
      await Promise.all([
        Banner.find(filter)
          .sort(sortOption)
          .skip(skip)
          .limit(perPage)
          .lean(),

        Banner.countDocuments(
          filter
        ),
      ]);

    return res.status(200).json({
      success: true,

      data: {
        banners,

        pagination: {
          page: currentPage,
          limit: perPage,
          totalBanners,
          totalPages: Math.ceil(
            totalBanners / perPage
          ),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ======================================================
// GET BANNER BY ID - ADMIN
// ======================================================

const getBannerById = async (
  req,
  res,
  next
) => {
  try {
    const banner =
      await Banner.findById(
        req.params.id
      ).lean();

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        banner,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ======================================================
// CREATE BANNER - ADMIN
// ======================================================

const createBanner = async (
  req,
  res,
  next
) => {
  try {
    const {
      title,
      description,
      discount,
      image,
      link,
      buttonText,
      type,
      position,
      isActive,
      startDate,
      endDate,
    } = req.body;

    const bannerType =
      type || "homepage";

    if (
      !BANNER_TYPES.includes(
        bannerType
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "type must be 'homepage' or 'offer'",
      });
    }

    // Offer banners are the "full" card - a title ties the
    // discount/link/button together, so it's required there.
    // Homepage banners only need image + description + discount.
    if (
      bannerType === "offer" &&
      !title
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Banner title is required for offer banners",
      });
    }

    if (!image) {
      return res.status(400).json({
        success: false,
        message:
          "Banner image is required",
      });
    }

    // A base64 data URL is pushed to Cloudinary here so the
    // blob never reaches MongoDB. An https URL is kept as-is.
    const uploadedImage =
      await resolveImageInput(
        image,
        "banners"
      );

    if (!uploadedImage?.url) {
      return res.status(400).json({
        success: false,
        message:
          "Banner image is required",
      });
    }

    const banner = await Banner.create({
      title: title ? title.trim() : "",
      description: description || "",
      discount: discount || "",
      image: uploadedImage,
      link:
        bannerType === "offer"
          ? link || ""
          : "",
      buttonText:
        bannerType === "offer"
          ? buttonText || "Shop Now"
          : "",
      type: bannerType,
      position: Number(position) || 0,
      isActive:
        typeof isActive === "boolean"
          ? isActive
          : true,
      startDate: startDate || null,
      endDate: endDate || null,
    });

    return res.status(201).json({
      success: true,
      message:
        "Banner created successfully",
      data: {
        banner,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ======================================================
// UPDATE BANNER - ADMIN
// ======================================================

const updateBanner = async (
  req,
  res,
  next
) => {
  try {
    const banner =
      await Banner.findById(
        req.params.id
      );

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
      });
    }

    const {
      title,
      description,
      discount,
      image,
      link,
      buttonText,
      type,
      position,
      isActive,
      startDate,
      endDate,
    } = req.body;

    if (title !== undefined) {
      banner.title = title.trim();
    }

    if (description !== undefined) {
      banner.description =
        description.trim();
    }

    if (discount !== undefined) {
      banner.discount =
        discount.trim();
    }

    if (link !== undefined) {
      banner.link = link.trim();
    }

    if (buttonText !== undefined) {
      banner.buttonText =
        buttonText.trim();
    }

    if (type !== undefined) {
      if (
        !BANNER_TYPES.includes(type)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "type must be 'homepage' or 'offer'",
        });
      }

      banner.type = type;
    }

    // Offer banners must keep a title once they're saved as "offer".
    if (
      banner.type === "offer" &&
      !banner.title
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Banner title is required for offer banners",
      });
    }

    if (position !== undefined) {
      banner.position =
        Number(position) || 0;
    }

    if (isActive !== undefined) {
      banner.isActive = Boolean(
        isActive
      );
    }

    if (startDate !== undefined) {
      banner.startDate =
        startDate || null;
    }

    if (endDate !== undefined) {
      banner.endDate =
        endDate || null;
    }

    if (image !== undefined) {
      const resolvedImage =
        await resolveImageInput(
          image,
          "banners"
        );

      if (resolvedImage?.url) {
        const previousPublicId =
          banner.image?.publicId;

        banner.image = resolvedImage;

        // Drop the old asset once the new one is stored.
        if (
          previousPublicId &&
          previousPublicId !==
            resolvedImage.publicId
        ) {
          await destroyImage(
            previousPublicId
          );
        }
      }
    }

    await banner.save();

    return res.status(200).json({
      success: true,
      message:
        "Banner updated successfully",
      data: {
        banner,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ======================================================
// UPDATE BANNER STATUS - ADMIN
// ======================================================

const updateBannerStatus = async (
  req,
  res,
  next
) => {
  try {
    const { isActive } = req.body;

    if (
      typeof isActive !== "boolean"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "isActive must be true or false",
      });
    }

    const banner =
      await Banner.findByIdAndUpdate(
        req.params.id,
        { isActive },
        {
          new: true,
          runValidators: true,
        }
      );

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "Banner status updated successfully",
      data: {
        banner,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ======================================================
// REORDER BANNERS - ADMIN
// body: { items: [{ id, position }, ...] }
// ======================================================

const reorderBanners = async (
  req,
  res,
  next
) => {
  try {
    const { items } = req.body;

    if (
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "items must be a non-empty array of { id, position }",
      });
    }

    await Promise.all(
      items.map(({ id, position }) =>
        Banner.findByIdAndUpdate(id, {
          position: Number(position) || 0,
        })
      )
    );

    return res.status(200).json({
      success: true,
      message:
        "Banner order updated successfully",
    });
  } catch (error) {
    next(error);
  }
};

// ======================================================
// DELETE BANNER - ADMIN
// Hard delete: banners are not referenced elsewhere, so the
// document and its Cloudinary asset are removed outright.
// ======================================================

const deleteBanner = async (
  req,
  res,
  next
) => {
  try {
    const banner =
      await Banner.findById(
        req.params.id
      );

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
      });
    }

    const publicId =
      banner.image?.publicId;

    await banner.deleteOne();

    if (publicId) {
      await destroyImage(publicId);
    }

    return res.status(200).json({
      success: true,
      message:
        "Banner deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getBanners,
  getAdminBanners,
  getBannerById,
  createBanner,
  updateBanner,
  updateBannerStatus,
  reorderBanners,
  deleteBanner,
};
