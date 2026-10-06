// web/src/preview/mode.ts
/** True only in the shareable prototype build (`npm run build:preview`); folded away everywhere else. */
export const PREVIEW = import.meta.env.VITE_PREVIEW === 'true'

/** The note shown wherever a feature is visible in the prototype but not active. */
export const NOT_ACTIVE_NOTE = 'Not active in this version of the prototype.'
