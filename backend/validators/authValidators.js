const { z } = require('zod');

const loginSchema = z.object({
  password: z.string().min(1, 'Le mot de passe est requis.'),
});

module.exports = { loginSchema };
