const mongoose = require("mongoose");

const Address = require("../models/Address");

// ======================================================
// GET ALL ADDRESSES
// ======================================================

const getAddresses = async (
  req,
  res,
  next
) => {
  try {
    const addresses =
      await Address.find({
        user: req.user.userId,
      })
        .sort({
          isDefault: -1,
          createdAt: -1,
        })
        .lean();

    return res.status(200).json({
      success: true,
      data: {
        addresses,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ======================================================
// GET SINGLE ADDRESS
// ======================================================

const getAddressById = async (
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
        message: "Invalid address ID",
      });
    }

    const address =
      await Address.findOne({
        _id: id,
        user: req.user.userId,
      }).lean();

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        address,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ======================================================
// CREATE ADDRESS
// ======================================================

const createAddress = async (
  req,
  res,
  next
) => {
  try {
    const {
      name,
      phone,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
      addressType,
      isDefault,
    } = req.body;

    if (
      !name ||
      !phone ||
      !addressLine1 ||
      !city ||
      !state ||
      !postalCode
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Name, phone, address, city, state and postal code are required",
      });
    }

    const userId =
      req.user.userId;

    // If first address, make it default
    const addressCount =
      await Address.countDocuments({
        user: userId,
      });

    const shouldBeDefault =
      addressCount === 0 ||
      isDefault === true;

    // If this is default,
    // remove default from other addresses
    if (shouldBeDefault) {
      await Address.updateMany(
        {
          user: userId,
          isDefault: true,
        },
        {
          $set: {
            isDefault: false,
          },
        }
      );
    }

    const address =
      await Address.create({
        user: userId,
        name: name.trim(),
        phone: phone.trim(),
        addressLine1:
          addressLine1.trim(),
        addressLine2:
          addressLine2
            ? addressLine2.trim()
            : "",
        city: city.trim(),
        state: state.trim(),
        postalCode:
          postalCode.trim(),
        country:
          country
            ? country.trim()
            : "India",
        addressType:
          addressType || "home",
        isDefault:
          shouldBeDefault,
      });

    return res.status(201).json({
      success: true,
      message:
        "Address added successfully",
      data: {
        address,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ======================================================
// UPDATE ADDRESS
// ======================================================

const updateAddress = async (
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
        message: "Invalid address ID",
      });
    }

    const address =
      await Address.findOne({
        _id: id,
        user: req.user.userId,
      });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    const {
      name,
      phone,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
      addressType,
      isDefault,
    } = req.body;

    if (name !== undefined) {
      address.name =
        name.trim();
    }

    if (phone !== undefined) {
      address.phone =
        phone.trim();
    }

    if (
      addressLine1 !== undefined
    ) {
      address.addressLine1 =
        addressLine1.trim();
    }

    if (
      addressLine2 !== undefined
    ) {
      address.addressLine2 =
        addressLine2.trim();
    }

    if (city !== undefined) {
      address.city =
        city.trim();
    }

    if (state !== undefined) {
      address.state =
        state.trim();
    }

    if (
      postalCode !== undefined
    ) {
      address.postalCode =
        postalCode.trim();
    }

    if (country !== undefined) {
      address.country =
        country.trim();
    }

    if (
      addressType !== undefined
    ) {
      address.addressType =
        addressType;
    }

    if (isDefault === true) {
      await Address.updateMany(
        {
          user: req.user.userId,
          _id: {
            $ne: address._id,
          },
          isDefault: true,
        },
        {
          $set: {
            isDefault: false,
          },
        }
      );

      address.isDefault = true;
    }

    await address.save();

    return res.status(200).json({
      success: true,
      message:
        "Address updated successfully",
      data: {
        address,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ======================================================
// SET DEFAULT ADDRESS
// ======================================================

const setDefaultAddress = async (
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
        message: "Invalid address ID",
      });
    }

    const address =
      await Address.findOne({
        _id: id,
        user: req.user.userId,
      });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    await Address.updateMany(
      {
        user: req.user.userId,
        isDefault: true,
      },
      {
        $set: {
          isDefault: false,
        },
      }
    );

    address.isDefault = true;

    await address.save();

    return res.status(200).json({
      success: true,
      message:
        "Default address updated successfully",
      data: {
        address,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ======================================================
// DELETE ADDRESS
// ======================================================

const deleteAddress = async (
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
        message: "Invalid address ID",
      });
    }

    const address =
      await Address.findOne({
        _id: id,
        user: req.user.userId,
      });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    const wasDefault =
      address.isDefault;

    await address.deleteOne();

    // If default address was deleted,
    // make another address default.
    if (wasDefault) {
      const nextAddress =
        await Address.findOne({
          user: req.user.userId,
        }).sort({
          createdAt: -1,
        });

      if (nextAddress) {
        nextAddress.isDefault =
          true;

        await nextAddress.save();
      }
    }

    return res.status(200).json({
      success: true,
      message:
        "Address deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAddresses,
  getAddressById,
  createAddress,
  updateAddress,
  setDefaultAddress,
  deleteAddress,
};