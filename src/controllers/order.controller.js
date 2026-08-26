const mongoose = require("mongoose");

const Order = require("../models/Order");

// ======================================================
// GET MY ORDERS
// ======================================================

const getMyOrders = async (
  req,
  res,
  next
) => {
  try {
    const orders =
      await Order.find({
        user: req.user.userId,
      })
        .sort({
          createdAt: -1,
        })
        .lean();

    return res.status(200).json({
      success: true,
      data: {
        orders,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ======================================================
// GET MY ORDER
// ======================================================

const getMyOrder = async (
  req,
  res,
  next
) => {
  try {
    const { id } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(id)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    const order =
      await Order.findOne({
        _id: id,
        user: req.user.userId,
      }).lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        order,
      },
    });
  } catch (error) {
    next(error);
  }
};


// ======================================================
// GET ALL ORDERS - ADMIN
// Search + Filters + Sort + Pagination
// ======================================================

const getAdminOrders = async (
  req,
  res,
  next
) => {
  try {
    const {
      search = "",
      orderStatus = "all",
      paymentStatus = "all",
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

    const skip =
      (currentPage - 1) * perPage;

    // --------------------------------------------------
    // FILTER
    // --------------------------------------------------

    const filter = {};

    // Order status
    if (
      orderStatus !== "all"
    ) {
      filter.orderStatus =
        orderStatus;
    }

    // Payment status
    if (
      paymentStatus !== "all"
    ) {
      filter.paymentStatus =
        paymentStatus;
    }

    // Search by order number
    if (search.trim()) {
      filter.orderNumber = {
        $regex: search.trim(),
        $options: "i",
      };
    }

    // --------------------------------------------------
    // SORT
    // --------------------------------------------------

    const sortOption =
      sort === "oldest"
        ? { createdAt: 1 }
        : { createdAt: -1 };

    // --------------------------------------------------
    // GET ORDERS
    // --------------------------------------------------

    const [
      orders,
      totalOrders,
    ] = await Promise.all([
      Order.find(filter)
        .populate(
          "user",
          "name email phone"
        )
        .populate(
          "payment"
        )
        .sort(sortOption)
        .skip(skip)
        .limit(perPage)
        .lean(),

      Order.countDocuments(
        filter
      ),
    ]);

    // --------------------------------------------------
    // RESPONSE
    // --------------------------------------------------

    return res.status(200).json({
      success: true,

      data: {
        orders,

        pagination: {
          page: currentPage,
          limit: perPage,
          totalOrders,
          totalPages: Math.ceil(
            totalOrders /
              perPage
          ),
        },

        filters: {
          search:
            search.trim(),
          orderStatus,
          paymentStatus,
          sort,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyOrders,
  getMyOrder,
  getAdminOrders,
};