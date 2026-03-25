const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    vehicleNumber: {
      type: String,
      required: [true, 'Vehicle number is required'],
      uppercase: true,
      trim: true,
    },
    model: {
      type: String,
      default: '',
      trim: true,
    },
    make: {
      type: String,
      default: '',
      trim: true,
    },
    fuelType: {
      type: String,
      default: '',
      trim: true,
    },
    registrationDate: {
      type: Date,
      default: null,
    },
    insuranceExpiry: {
      type: Date,
      default: null,
    },
    pucExpiry: {
      type: Date,
      default: null,
    },
    ownerName: {
      type: String,
      default: '',
      trim: true,
    },
    chassisNumber: {
      type: String,
      default: '',
      trim: true,
    },
    engineNumber: {
      type: String,
      default: '',
      trim: true,
    },
    vehicleClass: {
      type: String,
      default: '',
    },
    color: {
      type: String,
      default: '',
    },
    rawData: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

vehicleSchema.index({ userId: 1 });
vehicleSchema.index({ vehicleNumber: 1 });

module.exports = mongoose.model('Vehicle', vehicleSchema);
