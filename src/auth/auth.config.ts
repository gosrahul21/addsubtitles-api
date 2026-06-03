export const AUTH_CONFIG = {
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'access-secret-key-123',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'refresh-secret-key-123',
  jwtAccessExpiresIn: '15m',
  jwtRefreshExpiresIn: '7d',
  freeTierMaxProcessingLimit: 10, // Maximum allowed processing operations for Free/Anonymous users
};
