const crypto = require("crypto");
const Razorpay = require("razorpay");
const mongoose = require("mongoose");
const Order = require("../models/Order");

const Cart = require("../models/Cart");
const Address = require("../models/Address");
const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");
const Payment = require("../models/Payment");

// ======================================================
// RAZORPAY INSTANCE
// ======================================================

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret:
    process.env.RAZORPAY_KEY_SECRET,
});

// ======================================================
// CALCULATE CHECKOUT AMOUNT
// ======================================================

const calculateCheckoutAmount = async (
  userId,
  addressId
) => {
  const cart = await Cart.findOne({
    user: userId,
  }).lean();

  if (!cart || !cart.items.length) {
    throw new Error("Your cart is empty");
  }

  const address = await Address.findOne({
    _id: addressId,
    user: userId,
  }).lean();

  if (!address) {
    throw new Error("Address not found");
  }

  let subtotal = 0;

  const items = [];

  for (const cartItem of cart.items) {
    const product =
      await Product.findOne({
        _id: cartItem.product,
        isActive: true,
      }).lean();

    if (!product) {
      throw new Error(
        "One or more products are no longer available"
      );
    }

    let price = product.price;
    let stock = product.stock;
    let variant = null;

    if (product.hasVariants) {
      if (!cartItem.variant) {
        throw new Error(
          `${product.name} requires a variant`
        );
      }

      variant =
        await ProductVariant.findOne({
          _id: cartItem.variant,
          product: product._id,
          isActive: true,
        }).lean();

      if (!variant) {
        throw new Error(
          `Variant for ${product.name} is no longer available`
        );
      }

      price = variant.price;
      stock = variant.stock;
    }

    if (stock < cartItem.quantity) {
      throw new Error(
        `${product.name} has only ${stock} units available`
      );
    }

    const itemTotal =
      price * cartItem.quantity;

    subtotal += itemTotal;

    items.push({
      product: product._id,
      variant: variant
        ? variant._id
        : null,
      quantity: cartItem.quantity,
      price,
      itemTotal,
    });
  }

  const shipping =
    subtotal >= 500
      ? 0
      : 50;

  const total =
    subtotal + shipping;

  return {
    cart,
    address,
    items,
    subtotal,
    shipping,
    total,
  };
};

// ======================================================
// CREATE RAZORPAY ORDER
// ======================================================

const createPaymentOrder = async (
  req,
  res,
  next
) => {
  try {
    const userId =
      req.user.userId;

    const { addressId } =
      req.body;

    if (!addressId) {
      return res.status(400).json({
        success: false,
        message:
          "Address ID is required",
      });
    }

    // ----------------------------------------------
    // Recalculate everything from DB
    // ----------------------------------------------

    const checkout =
      await calculateCheckoutAmount(
        userId,
        addressId
      );

    if (checkout.total <= 0) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid checkout amount",
      });
    }

    // Razorpay uses paise
    const amountInPaise =
      Math.round(
        checkout.total * 100
      );

    // ----------------------------------------------
    // Generate unique receipt
    // ----------------------------------------------

    const receipt =
      `receipt_${userId}_${Date.now()}`;

    // ----------------------------------------------
    // Create Razorpay order
    // ----------------------------------------------

    const razorpayOrder =
      await razorpay.orders.create({
        amount:
          amountInPaise,
        currency: "INR",
        receipt,
        notes: {
          userId: userId.toString(),
          addressId:
            addressId.toString(),
        },
      });

    // ----------------------------------------------
    // Save payment in MongoDB
    // ----------------------------------------------

    const payment =
      await Payment.create({
        user: userId,
        razorpayOrderId:
          razorpayOrder.id,
        amount:
          checkout.total,
        currency: "INR",
        status: "created",
      });

    return res.status(201).json({
      success: true,
      message:
        "Payment order created successfully",

      data: {
        payment: {
          id: payment._id,
          razorpayOrderId:
            razorpayOrder.id,
          amount:
            checkout.total,
          amountInPaise,
          currency: "INR",
        },

        checkout: {
          items:
            checkout.items,
          subtotal:
            checkout.subtotal,
          shipping:
            checkout.shipping,
          total:
            checkout.total,
        },

        razorpay: {
          keyId:
            process.env
              .RAZORPAY_KEY_ID,
          orderId:
            razorpayOrder.id,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ======================================================
// VERIFY RAZORPAY PAYMENT
// ======================================================

const verifyPayment = async (
  req,
  res,
  next
) => {
  const session =
    await mongoose.startSession();

  try {
    const userId =
      req.user.userId;

    const {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    } = req.body;

    if (
      !razorpayOrderId ||
      !razorpayPaymentId ||
      !razorpaySignature
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Payment verification details are required",
      });
    }

    const payment =
      await Payment.findOne({
        razorpayOrderId,
        user: userId,
      });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message:
          "Payment order not found",
      });
    }

    // Already processed
    const existingOrder =
      await Order.findOne({
        razorpayOrderId,
      });

    if (existingOrder) {
      return res.status(200).json({
        success: true,
        message:
          "Order already created",
        data: {
          order: existingOrder,
        },
      });
    }

    // Verify signature
    const generatedSignature =
      crypto
        .createHmac(
          "sha256",
          process.env.RAZORPAY_KEY_SECRET
        )
        .update(
          `${razorpayOrderId}|${razorpayPaymentId}`
        )
        .digest("hex");

    const expectedBuffer =
      Buffer.from(
        generatedSignature,
        "utf8"
      );

    const receivedBuffer =
      Buffer.from(
        razorpaySignature,
        "utf8"
      );

    const signatureValid =
      expectedBuffer.length ===
        receivedBuffer.length &&
      crypto.timingSafeEqual(
        expectedBuffer,
        receivedBuffer
      );

    if (!signatureValid) {
      payment.status = "failed";

      payment.failureReason =
        "Invalid payment signature";

      await payment.save();

      return res.status(400).json({
        success: false,
        message:
          "Payment signature verification failed",
      });
    }

    // ==================================================
    // START TRANSACTION
    // ==================================================

    session.startTransaction();

    const cart =
      await Cart.findOne({
        user: userId,
      }).session(session);

    if (!cart || !cart.items.length) {
      await session.abortTransaction();

      return res.status(400).json({
        success: false,
        message:
          "Cart is empty",
      });
    }

    // Get address from Razorpay order notes
    const razorpayOrder =
      await razorpay.orders.fetch(
        razorpayOrderId
      );

    const addressId =
      razorpayOrder.notes?.addressId;

    const address =
      await Address.findOne({
        _id: addressId,
        user: userId,
      }).session(session);

    if (!address) {
      await session.abortTransaction();

      return res.status(400).json({
        success: false,
        message:
          "Shipping address not found",
      });
    }

    const orderItems = [];

    let subtotal = 0;

    // ==================================================
    // VALIDATE + DEDUCT STOCK
    // ==================================================

    for (const cartItem of cart.items) {
      const product =
        await Product.findOne({
          _id: cartItem.product,
          isActive: true,
        }).session(session);

      if (!product) {
        throw new Error(
          "Product is no longer available"
        );
      }

      let price = product.price;
      let variant = null;

      if (product.hasVariants) {
        if (!cartItem.variant) {
          throw new Error(
            `${product.name} requires a variant`
          );
        }

        variant =
          await ProductVariant.findOne({
            _id: cartItem.variant,
            product: product._id,
            isActive: true,
          }).session(session);

        if (!variant) {
          throw new Error(
            `${product.name} variant is no longer available`
          );
        }

        // Atomic stock check + deduction
        const updatedVariant =
          await ProductVariant.findOneAndUpdate(
            {
              _id: variant._id,
              stock: {
                $gte:
                  cartItem.quantity,
              },
            },
            {
              $inc: {
                stock:
                  -cartItem.quantity,
              },
            },
            {
              new: true,
              session,
            }
          );

        if (!updatedVariant) {
          throw new Error(
            `Insufficient stock for ${product.name}`
          );
        }

        price =
          updatedVariant.price;
      } else {
        // Atomic stock check + deduction
        const updatedProduct =
          await Product.findOneAndUpdate(
            {
              _id: product._id,
              stock: {
                $gte:
                  cartItem.quantity,
              },
            },
            {
              $inc: {
                stock:
                  -cartItem.quantity,
              },
            },
            {
              new: true,
              session,
            }
          );

        if (!updatedProduct) {
          throw new Error(
            `Insufficient stock for ${product.name}`
          );
        }

        price =
          updatedProduct.price;
      }

      const itemTotal =
        price *
        cartItem.quantity;

      subtotal += itemTotal;

      orderItems.push({
        product:
          product._id,

        productName:
          product.name,

        productImage:
          product.images?.[0]?.url ||
          null,

        variant:
          variant
            ? variant._id
            : null,

        variantName:
          variant
            ? variant.name
            : null,

        quantity:
          cartItem.quantity,

        price,

        itemTotal,
      });
    }

    const shipping =
      subtotal >= 500
        ? 0
        : 50;

    const total =
      subtotal + shipping;

    // ==================================================
    // VERIFY PAYMENT AMOUNT
    // ==================================================

    if (
      payment.amount !== total
    ) {
      throw new Error(
        "Payment amount does not match order amount"
      );
    }

    // ==================================================
    // CREATE ORDER
    // ==================================================

    const [order] =
      await Order.create(
        [
          {
            orderNumber:
              generateOrderNumber(),

            user: userId,

            items:
              orderItems,

            shippingAddress: {
              name:
                address.name,

              phone:
                address.phone,

              addressLine1:
                address.addressLine1,

              addressLine2:
                address.addressLine2,

              city:
                address.city,

              state:
                address.state,

              postalCode:
                address.postalCode,

              country:
                address.country,
            },

            subtotal,

            shipping,

            total,

            payment:
              payment._id,

            razorpayOrderId,

            razorpayPaymentId,

            paymentStatus:
              "captured",

            orderStatus:
              "confirmed",
          },
        ],
        {
          session,
        }
      );

    // ==================================================
    // UPDATE PAYMENT
    // ==================================================

    payment.razorpayPaymentId =
      razorpayPaymentId;

    payment.razorpaySignature =
      razorpaySignature;

    payment.status =
      "captured";

    payment.verifiedAt =
      new Date();

    await payment.save({
      session,
    });

    // ==================================================
    // CLEAR CART
    // ==================================================

    cart.items = [];

    await cart.save({
      session,
    });

    // ==================================================
    // COMMIT
    // ==================================================

    await session.commitTransaction();

    return res.status(201).json({
      success: true,
      message:
        "Payment verified and order created successfully",
      data: {
        order: {
          id: order._id,
          orderNumber:
            order.orderNumber,
          total:
            order.total,
          paymentStatus:
            order.paymentStatus,
          orderStatus:
            order.orderStatus,
        },
      },
    });
  } catch (error) {
    await session.abortTransaction();

    next(error);
  } finally {
    session.endSession();
  }
};

// ======================================================
// GET ALL PAYMENTS - ADMIN
// Search + Status + Sort + Pagination
// ======================================================

const getAdminPayments = async (
  req,
  res,
  next
) => {
  try {
    const {
      search = "",
      status = "all",
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

    // Payment status
    const allowedStatuses = [
      "created",
      "authorized",
      "captured",
      "failed",
      "refunded",
    ];

    if (status !== "all") {
      if (
        !allowedStatuses.includes(status)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid payment status",
        });
      }

      filter.status = status;
    }

    // Search Razorpay Order ID
    // or Razorpay Payment ID
    if (search.trim()) {
      filter.$or = [
        {
          razorpayOrderId: {
            $regex: search.trim(),
            $options: "i",
          },
        },
        {
          razorpayPaymentId: {
            $regex: search.trim(),
            $options: "i",
          },
        },
      ];
    }

    // --------------------------------------------------
    // SORT
    // --------------------------------------------------

    const sortOption =
      sort === "oldest"
        ? { createdAt: 1 }
        : { createdAt: -1 };

    // --------------------------------------------------
    // GET PAYMENTS
    // --------------------------------------------------

    const [
      payments,
      totalPayments,
    ] = await Promise.all([
      Payment.find(filter)
        .populate(
          "user",
          "name email phone"
        )
        .select(
          "-razorpaySignature"
        )
        .sort(sortOption)
        .skip(skip)
        .limit(perPage)
        .lean(),

      Payment.countDocuments(filter),
    ]);

    // --------------------------------------------------
    // RESPONSE
    // --------------------------------------------------

    return res.status(200).json({
      success: true,

      data: {
        payments,

        pagination: {
          page: currentPage,
          limit: perPage,
          totalPayments,
          totalPages: Math.ceil(
            totalPayments / perPage
          ),
        },

        filters: {
          search: search.trim(),
          status,
          sort,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};


// ======================================================
// GET PAYMENT BY ID - ADMIN
// ======================================================

const getAdminPaymentById = async (
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
        message: "Invalid payment ID",
      });
    }

    const payment =
      await Payment.findById(id)
        .populate(
          "user",
          "name email phone"
        )
        .select(
          "-razorpaySignature"
        )
        .lean();

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        payment,
      },
    });
  } catch (error) {
    next(error);
  }
};


const generateOrderNumber = () => {
  const timestamp = Date.now();

  const random =
    Math.floor(
      1000 + Math.random() * 9000
    );

  return `ORD-${timestamp}-${random}`;
};

module.exports = {
  createPaymentOrder,
  verifyPayment,
  getAdminPayments,
  getAdminPaymentById,
};