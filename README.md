# Air Strings

A browser app: pinch with both hands to draw glowing strings in the air, then pluck or strum them with your fingers to play notes. Webcam, hand tracking (MediaPipe), string physics, Karplus-Strong synthesis.

## Run it

```sh
nvm use          # Node version from .nvmrc
npm i
npm run dev      # http://localhost:5173
npm test         # Vitest
```

The camera only works on `localhost` or HTTPS.

## Deploy (Cloudflare static assets)

```sh
npx wrangler login   # once
npm run deploy       # builds, then wrangler deploy
```

## Privacy

Video is processed on your device. Nothing is uploaded. The hand-tracking model and WASM are downloaded from public CDNs.
