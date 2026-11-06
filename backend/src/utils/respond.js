export const sendSuccess = (res, data, statusCode = 200, meta = undefined) => {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
};

export const sendError = (res, statusCode, message, details = undefined) => {
  const body = { success: false, message };
  if (details) body.details = details;
  return res.status(statusCode).json(body);
};

export default sendSuccess;
