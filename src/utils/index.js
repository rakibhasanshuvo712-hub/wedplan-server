const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const sendSuccess = (res, data, message = 'OK', status = 200) =>
  res.status(status).json({ success: true, message, data });

const sendError = (res, message = 'Error', status = 500) =>
  res.status(status).json({ success: false, error: message });

module.exports = { asyncHandler, sendSuccess, sendError };
