# Contributing Guide

## Branch Strategy

```
main                 ← production-ready, protected
  ↑ PRs from: dev · hotfix/*
dev                  ← integration / staging
  ↑ PRs from: feature/frontend · feature/backend · hotfix/*
feature/frontend     ← React / TypeScript frontend work
feature/backend      ← FastAPI / Python backend work
hotfix/<name>        ← emergency production patches
release/<version>    ← release preparation
```

### Rule summary

| Branch | Push directly? | Source | Merges into |
|--------|---------------|--------|-------------|
| `main` | ❌ Never | `dev`, `hotfix/*` | — |
| `dev` | ❌ Never | `feature/*`, `hotfix/*` | `main` |
| `feature/frontend` | ✅ Yes | `dev` | `dev` |
| `feature/backend` | ✅ Yes | `dev` | `dev` |
| `hotfix/*` | ✅ Yes | `main` | `main` + `dev` |
| `release/*` | ✅ Yes | `dev` | `main` |

---

## Day-to-day workflow

### Frontend work

```bash
# 1. Sync your local feature/frontend with the latest dev
git checkout feature/frontend
git pull origin dev --rebase

# 2. Make your changes
# ... edit src/ files ...

# 3. Push
git add .
git commit -m "feat(ui): short description"
git push origin feature/frontend

# 4. Open a PR: feature/frontend → dev
```

CI that runs on `feature/frontend`: ESLint, TypeScript check, Vite build.

### Backend work

```bash
# 1. Sync your local feature/backend with the latest dev
git checkout feature/backend
git pull origin dev --rebase

# 2. Make your changes
# ... edit backend/app/ files ...

# 3. Push
git add .
git commit -m "feat(api): short description"
git push origin feature/backend

# 4. Open a PR: feature/backend → dev
```

CI that runs on `feature/backend`: ruff lint, pytest.

### Integrating into dev

Once your feature PR is approved and merged into `dev`:
- The full integration CI runs (frontend + backend + integration check).
- If CI passes, `dev` is ready to be promoted to `main`.

### Promoting dev → main (release)

```bash
# Open a PR: dev → main
# All CI checks must pass.
# On merge to main, the deploy job runs automatically.
```

### Emergency hotfix

```bash
# Branch from main (not dev!)
git checkout main
git pull origin main
git checkout -b hotfix/fix-login-crash

# Fix the issue, commit, push
git push origin hotfix/fix-login-crash

# Open TWO PRs:
#   hotfix/fix-login-crash → main   (production fix)
#   hotfix/fix-login-crash → dev    (keep dev in sync)
```

---

## Commit message format

```
type(scope): short description

Types: feat · fix · ci · docs · refactor · test · chore
Scope: frontend · backend · api · ui · auth · db · ci (optional)

Examples:
  feat(ui): add dark-mode toggle to settings page
  fix(api): validate URL before storing workflow
  ci: add backend linting to feature/backend workflow
```

---

## CI / CD overview

| Branch | Workflows triggered |
|--------|-------------------|
| `feature/frontend` | `feature-frontend.yml` — fast frontend CI |
| `feature/backend` | `feature-backend.yml` — fast backend CI |
| `dev` | `ci.yml` — full CI + integration check |
| `main` | `ci.yml` — full CI + production deploy |
| `hotfix/*` | `hotfix.yml` — full CI |
| PR → `dev` | feature workflow for source branch |
| PR → `main` | `ci.yml` full CI |

---

## Environment setup

```bash
# Backend
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
playwright install chromium
cp ../.env.example ../.env   # add SECRET_KEY and OPENAI_API_KEY
python init_db.py            # creates tables + seeds admin user
uvicorn app.main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
cp .env.example .env         # set VITE_API_URL and VITE_WS_URL
npm run dev
```

Or use `./start.sh` which handles all of the above automatically.
