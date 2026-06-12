"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CACHE_KEYS = void 0;
exports.CACHE_KEYS = {
    SUBSCRIPTION_PLANS: 'subscription_plans_cache',
    USER_PROFILE: (userId) => `user_me_${userId}`,
    USER_PRESETS: (userId) => `presets_user_${userId}`,
    PROJECT_DETAILS: (projectId) => `project_${projectId}`,
};
//# sourceMappingURL=cache.constants.js.map