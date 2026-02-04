# HoboDraft

Professional screenwriting application built with React Ionic and Deno.

## Development

1. Install dependencies:
   ```
   npm install
   ```

2. Start the Vite dev server (frontend only):
   ```
   npm run dev
   ```

3. In another terminal, start the Deno API server:
   ```
   deno task dev
   ```

## Production Build

```
npm run build
```

This builds the React app into the `static/` folder.

## Deploy

Push to GitHub and it will auto-deploy to Deno Deploy via GitHub Actions.

## Manual Deploy

```
deno task start
```
