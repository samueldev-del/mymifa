const { sendError } = require('../utils/http');

const validate = (schema, source = 'body') => (req, res, next) => {
  const parsed = schema.safeParse(req[source]);

  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));

    return sendError(res, 400, 'VALIDATION_ERROR', 'Requete invalide.', details);
  }

  req[source] = parsed.data;
  return next();
};

module.exports = validate;
