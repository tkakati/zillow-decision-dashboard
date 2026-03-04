# Home Decision Dashboard (Prototype v1)

A Zillow-like web app prototype for renters comparing **already-shortlisted** homes. It uses 6 hardcoded demo houses and deterministic scoring to rank tradeoffs without any backend.

## What It Includes

- Next.js App Router + TypeScript + Tailwind CSS
- Preferences onboarding with persistence:
  - Move-in date range (calendar inputs + speech-text parsing stub)
  - Bed/Bath preference sliders
  - Pets toggle + pet type multi-select
- Dynamic attribute selection (10 attributes) + per-attribute weight sliders
- Deterministic weighted normalized scoring and rank generation
- AI insights toggle (explanations are deterministic templates in v1)
- Numeric-only column sorting
- Drag-and-drop row reordering with persisted row order
- LocalStorage persistence across sessions

## Run Locally

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Access The UI

1. Start the app:

   ```bash
   npm run dev
   ```

2. Open your browser:

   - [http://localhost:3000](http://localhost:3000)

3. If port `3000` is busy:

   ```bash
   npm run dev -- --port 3001
   ```

   Then open [http://localhost:3001](http://localhost:3001).

## Deploy (Vercel Recommended)

This project is frontend-only and does not need a backend service.

1. Push the repo to GitHub.
2. Go to [Vercel](https://vercel.com).
3. Click **Add New... -> Project**.
4. Import your GitHub repo.
5. Keep defaults (Framework should auto-detect as Next.js).
6. Click **Deploy**.

No environment variables are required for v1.

## Railway vs Vercel

- Use **Vercel** for this project right now.
- **Railway** is not required for v1 because there is no backend/database.
- You can add Railway later if you introduce an API service.

## Push To GitHub (First Time)

If this folder is not already a git repo:

```bash
git init
git add .
git commit -m "Build Home Decision Dashboard v1"
git branch -M main
git remote add origin <YOUR_GITHUB_REPO_URL>
git push -u origin main
```

If git is already initialized, use:

```bash
git add .
git commit -m "Polish dashboard UX and docs"
git push
```

## Scoring Logic

Ranking activates only when there are at least:

- 3 houses
- 3 selected attributes

For each selected attribute:

- Numeric: min-max normalize among displayed houses (`max == min => 0.5`)
- Boolean: `true = 1`, `false = 0`
- Rating (1-5): `value / 5`
- Lower-is-better fields invert normalized values

Weighted score:

```text
score = sum(norm_i * weight_i) / sum(weight_i)
```

Rank is descending by score (`#1` = best score). The table keeps manual row order unless user applies numeric sorting.

## V2 Ideas

- Replace deterministic explanation templates with LLM-generated tradeoff summaries.
- Upgrade move-in voice flow by connecting microphone capture + LLM/ASR parsing into `parseDateRangeFromSpeech(text)`.
- Add richer personalization signals (neighborhood vibe, amenity priorities, lease flexibility).

## Project Structure

- `data/houses.json`
- `data/attributeSchema.ts`
- `lib/scoring.ts`
- `lib/storage.ts`
- `lib/dateRange.ts`
- `components/PreferencesCard.tsx`
- `components/AttributeSelector.tsx`
- `components/DashboardTable.tsx`
- `app/page.tsx`
