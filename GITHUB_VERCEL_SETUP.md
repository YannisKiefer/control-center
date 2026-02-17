# GitHub + Vercel Integration Setup

## Schritt 1: GitHub Repo erstellen

1. Gehe zu https://github.com/new
2. Repository Name: `control-center`
3. Private oder Public (wie du willst)
4. NICHT initialisieren mit README
5. Create repository

## Schritt 2: Lokalen Code pushen

```bash
cd /pfad/zu/control-center
git remote add origin https://github.com/DEIN_USERNAME/control-center.git
git branch -M main
git push -u origin main
```

## Schritt 3: Vercel verbinden

1. Gehe zu https://vercel.com/new
2. Importiere das GitHub Repo `control-center`
3. Framework: Next.js
4. Root Directory: `./`
5. Build Command: `npm run build`
6. Deploy

## Fertig!

Bei jedem `git push` wird automatisch deployed.

## Schnellbefehle

```bash
# Deployen
git add .
git commit -m "Update"
git push

# Status prüfen
vercel --version
```
