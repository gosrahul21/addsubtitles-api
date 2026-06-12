"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AUTH_CONFIG = void 0;
exports.AUTH_CONFIG = {
    jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'access-secret-key-123',
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'refresh-secret-key-123',
    jwtAccessExpiresIn: '15m',
    jwtRefreshExpiresIn: '7d',
    freeTierMaxProcessingLimit: 10,
};
//# sourceMappingURL=auth.config.js.map