import helmet from "helmet";

/**
 * Helmet 8 security headers
 *
 * crossOriginEmbedderPolicy is intentionally disabled - enabling it
 * (require-corp) breaks third-party assets lacking matching CORP headers
 */
export const helmetMiddleware = helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
});
