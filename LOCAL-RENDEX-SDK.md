# Local Rendex SDK

- The browser loads `/vendor/rendex-sdk.min.js` from `redfilm.win`.
- `npm run build` downloads the current SDK from Graphicslab into `public/vendor`.
- The SDK response has `Cache-Control: public, max-age=3600, stale-while-revalidate=86400`.
- The removed trailer component is not included.
- The main player keeps `data-autoplay="true"`.
