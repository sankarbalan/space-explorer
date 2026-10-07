# Space Explorer — Frontend + Backend

This project keeps the supplied Space Explorer frontend and adds two backend features:

1. **Error / question report:** the existing About → “Found an error? Have a question?” form sends Name, Email and Message to the owner's email using Nodemailer.
2. **External question search:** the existing Mysteries search first keeps the site's own local results, then asks the backend for external results. If Google Custom Search credentials are configured, it uses Google; otherwise it uses Wikipedia as a free fallback.

## Folder structure

```text
space-explorer-backend/
├─ frontend/
│  └─ index.html
├─ backend/
│  ├─ server.js
│  ├─ package.json
│  └─ .env.example
└─ README.md
```

## Setup

### 1. Install Node.js
Use a current LTS version.

### 2. Install backend packages
Open Command Prompt / PowerShell inside `backend`:

```bash
cd backend
npm install
```

### 3. Create `.env`
Copy `.env.example` to `.env` and fill in your values.

For local development, either use Resend or Gmail SMTP. `OWNER_EMAIL` is the address that receives visitor messages.

Example:

```env
PORT=3000
OWNER_EMAIL=your-email@gmail.com
RESEND_API_KEY=re_your_api_key
RESEND_FROM=Space Explorer <onboarding@resend.dev>
```

Resend's `onboarding@resend.dev` sender is for testing; verify your recipient address in Resend. For production, verify a domain in Resend and set `RESEND_FROM` to an address on that domain. SMTP remains available as a local fallback:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-google-app-password
```

### 4. Optional Google search
For broader web search, create a Google Programmable Search / Custom Search JSON API setup and put its credentials in `.env`:

```env
GOOGLE_API_KEY=your-key
GOOGLE_CX=your-search-engine-id
```

If these are empty, the backend automatically uses Wikipedia instead.

### 5. Start

```bash
npm start
```

Open:

```text
http://localhost:3000
```

Do **not** open `frontend/index.html` directly with `file://...` when testing the backend features. Open it through the Node/Express server.

### Production deployment on Render

The root `render.yaml` configures the Node web service to serve both the frontend and API. Create a Render Blueprint from the GitHub repository, then set `OWNER_EMAIL` and `RESEND_API_KEY` as service environment variables. Set `RESEND_FROM` to your verified sender domain for production. Keep API keys in Render's environment settings, never in Git.

## API endpoints

- `GET /api/health` — checks backend configuration.
- `POST /api/contact` — sends the visitor's message to `OWNER_EMAIL`.
- `GET /api/search?q=...` — searches Google when configured, otherwise Wikipedia.

## Important security notes

- Never put SMTP passwords or Google API keys inside `frontend/index.html`.
- Keep `.env` private and do not upload it to GitHub.
- For production, add rate limiting, CAPTCHA/Turnstile, request logging, and stricter origin/CORS rules.
- External search results are displayed with their original source links; the site does not claim that every external answer is automatically correct.
