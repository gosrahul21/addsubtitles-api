export const CACHE_KEYS = {
  SUBSCRIPTION_PLANS: 'subscription_plans_cache',
  USER_PROFILE: (userId: string) => `user_me_${userId}`,
  USER_PRESETS: (userId: string) => `presets_user_${userId}`,
  PROJECT_DETAILS: (projectId: string) => `project_${projectId}`,
};
