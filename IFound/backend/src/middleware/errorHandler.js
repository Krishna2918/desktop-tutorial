const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Default error
  let status = err.status || 500;
  let message = err.message || 'Internal server error';
  let errors = err.errors || null;

  // Sequelize validation errors
  if (err.name === 'SequelizeValidationError') {
    status = 400;
    message = 'Validation error';
    errors = err.errors.map(e => ({
      field: e.path,
      message: e.message,
    }));
  }

  // Sequelize unique constraint error
  if (err.name === 'SequelizeUniqueConstraintError') {
    status = 409;
    message = 'Resource already exists';
    errors = err.errors.map(e => ({
      field: e.path,
      message: `${e.path} must be unique`,
    }));
  }

  // Sequelize foreign key constraint error
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    status = 400;
    message = 'Invalid reference';
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    status = 403;
    message = 'Invalid token';
  }

  if (err.name === 'TokenExpiredError') {
    status = 403;
    message = 'Token expired';
  }

  // Multer file upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    status = 400;
    message = 'File too large';
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    status = 400;
    message = 'Unexpected file field';
  }

  // Send response
  res.status(status).json({
    success: false,
    message,
    errors,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

// 404 handler
const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
};

// Async error wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
};
