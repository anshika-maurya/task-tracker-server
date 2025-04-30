const errorHandlerMiddleware = (err, req, res, next) => {
  let customError = {
    // set default
    statusCode: err.statusCode || 500,
    message: err.message || 'Something went wrong, please try again later'
  };

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    customError.message = Object.values(err.errors)
      .map((item) => item.message)
      .join(', ');
    customError.statusCode = 400;
  }

  // Mongoose duplicate key
  if (err.code && err.code === 11000) {
    customError.message = `Duplicate value entered for ${Object.keys(
      err.keyValue
    )} field, please choose another value`;
    customError.statusCode = 400;
  }

  // Mongoose cast error
  if (err.name === 'CastError') {
    customError.message = `No item found with id: ${err.value}`;
    customError.statusCode = 404;
  }

  return res.status(customError.statusCode).json({ message: customError.message });
};

module.exports = errorHandlerMiddleware; 