import { registerAs } from '@nestjs/config';

const DEV_SECRET = 'dev-secret-change-me';

export default registerAs('jwt', () => {
  const secret = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') {
    // Never sign tokens with the public development fallback in production.
    if (!secret || secret === DEV_SECRET || secret === 'not-secret') {
      throw new Error(
        'JWT_SECRET must be set to a strong secret in production',
      );
    }
  }
  return {
    secret: secret || DEV_SECRET,
    expiresIn: process.env.JWT_EXPIRATION || '7d',
  };
});
