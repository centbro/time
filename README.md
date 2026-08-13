Travel Form App — Deployment

This is a small static single-page app that generates center-style trip application and report previews and can produce PDFs.

Options to host on the internet (pick one):

1) Vercel (recommended for quick static + node)
- Install Vercel CLI: `npm i -g vercel`
- From project folder run: `vercel` and follow prompts. It will detect `package.json` and deploy.

2) Netlify
- Install Netlify CLI: `npm i -g netlify-cli`
- Run `netlify deploy --dir=.` and follow prompts (use `--prod` to make it public).

3) GitHub Pages (static only)
- Remove `server.js` or deploy only the static build. Push repo to GitHub then enable Pages in repo settings (branch: `main`, folder: `/ (root)`). Note: GitHub Pages serves static files and won't run `server.js`.

4) Run locally and expose via ngrok for quick sharing
- Install dependencies: `npm install`
- Start server: `npm start` (opens on `http://localhost:3000`)
- Install ngrok and run: `ngrok http 3000` — it gives a public HTTPS URL you can share.

Notes and security
- This app serves static files and performs PDF generation in the browser. It does not store uploaded files server-side.
- If you want multi-user data persistence or uploads stored on the server, I can add an API and a database, but that'll need authentication and storage decisions.

Commands

Install & run locally:

```bash
npm install
npm start
```

Expose via ngrok (optional):

```bash
npm install -g ngrok
ngrok http 3000
```

Deploy to Vercel (quick):

```bash
npm i -g vercel
vercel
```

If you want, I can prepare a `vercel.json` and CI-ready config or wire a simple server-side upload endpoint and a small SQLite store. Which deployment option do you prefer?