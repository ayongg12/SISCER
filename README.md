# YOLO26 Vision — Vercel + Roboflow Workflows

A browser-based webcam object-detection dashboard. The browser captures frames; a Vercel serverless function forwards each frame to the Roboflow Workflow. The Roboflow API key stays on the server.

## Project structure

```text
.
├── .env.example
├── .gitignore
├── package.json
├── vercel.json
├── api/
│   └── detect.js
└── public/
    ├── index.html
    ├── styles.css
    └── app.js
```

## 1. Set up the API key

1. Regenerate the Roboflow API key if the previous key was shared publicly.
2. Copy `.env.example` to `.env` for local use, then set `ROBOFLOW_API_KEY` to the new key.
3. Never commit `.env` or place the key in `public/app.js`.

For Vercel, add `ROBOFLOW_API_KEY` under **Project → Settings → Environment Variables**, for Production and Preview as needed.

## 2. Deploy to Vercel

1. Upload this project to a GitHub repository (extract the ZIP first).
2. In Vercel choose **Add New → Project** and import the repository.
3. Framework preset: **Other**. Root directory: `./`.
4. Add `ROBOFLOW_API_KEY` in Environment Variables.
5. Deploy. Vercel serves `public/index.html` and exposes `api/detect.js` as a serverless function.

No build command is required. The app uses native browser JavaScript and the Vercel Node.js Function runtime.

## 3. Run locally (optional)

Install the Vercel CLI, create a local `.env` containing `ROBOFLOW_API_KEY`, then run:

```bash
npx vercel dev
```

Open the local URL printed by Vercel. Camera access on deployed Vercel domains works over HTTPS; local development is also allowed on localhost.

## Workflow configuration

The API is configured for:

- Workspace: `marias-workspace-latfm`
- Workflow slug: `benda-meja-kelompok-10`
- Image input name: `image`
- Endpoint: `https://serverless.roboflow.com/marias-workspace-latfm/workflows/benda-meja-kelompok-10`

The function sends the captured JPEG as a base64 image input and authenticates using `Authorization: Bearer ...`. Confirm that the workflow input is named `image` and accepts an image payload. If the workflow slug or input name differs in Roboflow, update `WORKFLOW_URL` or the `inputs.image` property in `api/detect.js`.

## Notes and limitations

- This is near-real-time frame inference, not a persistent WebRTC video session. Each frame is a separate HTTP request.
- Inference speed depends on network latency, Roboflow plan, workflow execution, and selected interval.
- The UI parser supports common object-detection prediction structures. If the workflow returns a custom output schema, adjust `findPredictions()` in `public/app.js`.
- The API key is intentionally not included in this ZIP. Add it as a Vercel environment variable.
