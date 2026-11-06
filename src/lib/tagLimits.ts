/** Longest tag, in characters (without the #). Also the limit for renaming in Manage tags. */
export const TAG_MAX_LENGTH = 15;
/** How many tags one note, event or habit can carry on the free plan. */
export const FREE_TAG_LIMIT = 5;
/** The same with Premium. */
export const PREMIUM_TAG_LIMIT = 25;

export const tagLimitFor = (isPremium: boolean) => (isPremium ? PREMIUM_TAG_LIMIT : FREE_TAG_LIMIT);
