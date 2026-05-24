// Wrap async route handlers so rejected promises reach the error handler
// (Express 4 does not forward async errors automatically).
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
