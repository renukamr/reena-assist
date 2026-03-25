const mongoose = require('mongoose');

const serviceRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    mechanicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Mechanic',
      default: null,
    },
    vehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
      default: null,
    },
    serviceType: {
      type: String,
      required: [true, 'Service type is required'],
      enum: [
        'fuel_delivery',
        'battery_jumpstart',
        'mechanic_support',
        'puncture_repair',
        'engine_repair',
        'breakdown_help',
        'taxi_request',
      ],
    },
    status: {
      type: String,
      default: 'pending',
      enum: ['pending', 'accepted', 'in_progress', 'completed', 'cancelled'],
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        default: [0, 0],
      },
      address: {
        type: String,
        default: '',
      },
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    price: {
      estimated: { type: Number, default: 0 },
      final: { type: Number, default: 0 },
    },
    notes: {
      type: String,
      default: '',
    },
    completedAt: {
      type: Date,
      default: null,
    },
    rating: {
      score: { type: Number, min: 1, max: 5, default: null },
      review: { type: String, default: '' },
    },
  },
  { timestamps: true }
);

serviceRequestSchema.index({ location: '2dsphere' });
serviceRequestSchema.index({ userId: 1 });
serviceRequestSchema.index({ mechanicId: 1 });
serviceRequestSchema.index({ status: 1 });

module.exports = mongoose.model('ServiceRequest', serviceRequestSchema);
