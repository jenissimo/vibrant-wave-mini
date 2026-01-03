# Vibrant Wave Editor

**Vibrant Wave** is an AI-powered **canvas editor** where **what you see on the canvas is the main conditioning signal** for generation.

Every time you hit **Generate**, the app takes the **visible composition** inside the *Generation Area*, optionally mixes in your **extra reference images**, adds your **text prompt**, sends it to the image LLM — and returns the result as a **new layer** on top.

> Mental model: **WYSIWYP — What You See Is Your Prompt.**
> You “author” the prompt with layers, masks and framing — not only with text.

> **Model stack (current):** Requests go through **OpenRouter** and are executed by **nano-banana** (our image-LLM relay). The model is swappable later; today we default to `google/gemini-2.5-flash-image-preview` via OpenRouter, executed through nano-banana.

## What you can do in 10 seconds

* **Outpaint empty borders** — expand the frame, hit **Generate**, the white areas fill in contextually.
* **Local fix (Inpaint)** — paint a mask over a region and regenerate just that area.
* **Style lift** — drop 1–2 style refs, adjust prompt, get a tasteful new layer.
* **Quick variants** — set `variantCount: 3–4`, keep the best, hide the rest.

## Examples

### Example 1: Basic Generation
![Basic Generation Example](docs/example1.png)
*Standard AI image generation from text prompts*

### Example 2: Grid Generation
![Grid Generation Example](docs/example2.png)
*Filling a grid with variations based on reference examples*

### Example 3: Canvas Composition
![Canvas Composition Example](docs/example_3.png)
*Combining elements on canvas - dressing a person in a suit and creating a photo*

---

## Quickstart

### 1. Get OpenRouter API Key
1. Go to [OpenRouter.ai](https://openrouter.ai)
2. Sign up/login and go to [API Keys](https://openrouter.ai/keys)
3. Create a new API key (starts with `sk-or-...`)
4. Copy the key for the next step

### 2. Setup Environment
Create `.env.local` in project root:
```env
# Required: paste your OpenRouter API key here
OPENROUTER_API_KEY=sk-or-your-key-here

# Optional: override default model (default: google/gemini-2.5-flash-image-preview)
OPENROUTER_IMAGE_MODEL=google/gemini-2.5-flash-image-preview
```

### 3. Run Development Server
Choose your platform:

**Windows:**
```cmd
run_win.bat
```

**macOS:**
```bash
./run_mac.sh
```

**Linux:**
```bash
./run_linux.sh
```

**Manual (any platform):**
```bash
bun run dev
```

App runs on `http://localhost:3000` by default.

### 5. Build & Deploy
```bash
bun run build
bun run start
```

---

## Scripts
```json
{
  "dev": "next dev --turbopack",
  "build": "next build --turbopack",
  "start": "next start",
  "lint": "eslint"
}
```
Run with Bun:
```bash
bun run dev
bun run build
bun run start
```

---

## API
Endpoint: `POST /api/generate`

Body (JSON):
```json
{
  "prompt": "cinematic portrait, warm lighting",
  "canvas": "data:image/png;base64,....",
  "attachments": ["data:image/png;base64,...."],
  "model": "google/gemini-2.5-flash-image-preview",
  "variantCount": 3
}
```

Behavior:
- Server resizes input images to ~1MP using `sharp` (keeps aspect) for efficient LLM input.
- Calls OpenRouter chat completions with image+text modalities.
- Returns up to `variantCount` image URLs and combined textual output.

Response (shape):
```json
{
  "variants": [
    { "image": "https://...", "text": "...optional text..." }
  ],
  "text": "Combined text across variants",
  "image": "https://..." // first image for convenience
}
```

---

## Development Tips
- **UI Components**: shadcn/ui primitives in `src/components/ui`
- **Canvas Tools**: Konva-based components in `src/components/canvas` and `src/components/Canvas*`
- **State Management**: Zustand stores in `src/lib` for settings, history, and canvas state
- **Command Pattern**: undo/redo system with commands in `src/lib/commands`
- **Hotkeys**: global keyboard shortcuts in `src/lib/useGlobalHotkeys`
- **Theme**: CSS custom properties with dark/light mode support

---

## Deployment
Any Next.js-compatible host works (Vercel recommended).
- Set environment variables (`OPENROUTER_API_KEY`, optional `OPENROUTER_IMAGE_MODEL`).
- Build with `bun run build` or via the host's build step.
- Ensure serverless runtime can fetch `https://openrouter.ai/api/v1/chat/completions`.

### Optional Authentication
The app supports optional authentication via NextAuth with two modes:

#### Mode 1: OIDC (Authelia) - Recommended for production
When OIDC variables are configured, the app uses OIDC authentication and automatically redirects to the identity provider. Credentials authentication is disabled in this mode.

Required variables:
- `OIDC_ISSUER_URL` - Your OIDC provider's issuer URL (e.g., `https://idp.lofters.ru`)
- `OIDC_CLIENT_ID` - OIDC client ID
- `OIDC_CLIENT_SECRET` - OIDC client secret
- `OIDC_LOGOUT_URI` - OIDC logout endpoint (e.g., `https://idp.lofters.ru/logout`)

#### Mode 2: Credentials (Username/Password)
When OIDC is not configured, the app falls back to simple username/password authentication:
- Set `AUTH_ENABLED=true` to enable authentication
- Configure `AUTH_USER` and `AUTH_PASSWORD` for login credentials

#### Common Authentication Variables
- `NEXTAUTH_URL` - Your application URL (e.g., `https://your-domain.com` or `http://localhost:3000`)
- `NEXTAUTH_SECRET` - Generate a secure secret (e.g., `openssl rand -base64 32`)

Example production `.env` with OIDC:
```env
OPENROUTER_API_KEY=sk-or-your-key-here
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your-generated-secret
OIDC_ISSUER_URL=https://idp.your-domain.ru
OIDC_CLIENT_ID=your-client-id
OIDC_CLIENT_SECRET=your-client-secret
OIDC_LOGOUT_URI=https://idp.your-domain.ru/logout
```

Example production `.env` with credentials:
```env
OPENROUTER_API_KEY=sk-or-your-key-here
AUTH_ENABLED=true
AUTH_USER=admin
AUTH_PASSWORD=your-secure-password
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your-generated-secret
```

#### Docker Compose
When using Docker Compose, all authentication variables are automatically passed from your `.env` file to the container. See `docker-compose.yml` for the complete list of supported environment variables.

---

## Troubleshooting
- **Missing API key**: `OPENROUTER_API_KEY` not set → API returns 500 with explicit error
- **Sharp issues**: on Windows, update Node/Bun and reinstall deps (`rm -rf node_modules && bun install`)
- **Empty variants**: check model quota and ensure input images are valid data URLs
- **Canvas not loading**: check browser console for Konva/React-Konva errors
- **Hotkeys not working**: ensure focus is on canvas, not input fields

---

## License
MIT
