/**
 * Centralized error response helper.
 * Translates Mongoose/JWT errors into consistent HTTP responses.
 */

const handleError = (res, error, context = '') => {
  if (context) console.error(`[${context}]`, error);

  // MongoDB invalid ObjectId
  if (error.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: `Invalid ID format: ${error.value}`,
    });
  }

  // MongoDB duplicate key (unique constraint)
  if (error.code === 11000) {
    const field = Object.keys(error.keyValue || {})[0] || 'field';
    const value = error.keyValue?.[field];
    return res.status(409).json({
      success: false,
      message: `${field.charAt(0).toUpperCase() + field.slice(1)} '${value}' is already registered.`,
    });
  }

  // Mongoose validation error
  if (error.name === 'ValidationError') {
    const messages = Object.values(error.errors).map((e) => e.message);
    return res.status(400).json({
      success: false,
      message: messages.join('. '),
    });
  }

  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, message: 'Invalid token.' });
  }
  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, message: 'Token expired. Please login again.' });
  }

  // Default 500
  return res.status(500).json({
    success: false,
    message: error.message || 'An unexpected error occurred.',
  });
};

module.exports = { handleError };
