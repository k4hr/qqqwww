# REDFILM performance patch

- Enabled responsive Next.js image optimization (AVIF/WebP) for Yandex/TMDB posters and hero images.
- Removed `unoptimized` from homepage cards and hero assets.
- Added a 30-day optimized image cache TTL.
- Converted movie cards back to Server Components.
- Replaced per-card React click handlers with one delegated analytics listener.
- Deferred below-the-fold panel rendering with `content-visibility: auto`.
- Removed obsolete multi-megabyte PNG background assets.
- Kept Yandex Metrika delayed until idle time.
- Fixed npm lockfile registry URLs so production builds use registry.npmjs.org.
