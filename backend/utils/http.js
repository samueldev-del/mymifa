const sendSuccess = (res, statusCode, data, message) => {
  const payload = { success: true, data };
  if (message) payload.message = message;
  return res.status(statusCode).json(payload);
};

const sendError = (res, statusCode, code, message, details) => {
  const payload = {
    success: false,
    error: {
      code,
      message,
    },
  };

  if (details) payload.error.details = details;

  return res.status(statusCode).json(payload);
};

module.exports = {
  sendSuccess,
  sendError,
};
