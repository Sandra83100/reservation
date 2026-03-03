# CLAUDE.md — Contexte projet : Réservation d'ateliers

> Ce fichier est chargé automatiquement par Claude Code à chaque session.
> Il contient tout ce qu'il faut savoir pour reprendre le travail immédiatement.

> ⚠️ **RÈGLE ABSOLUE** : Toujours travailler sur la branche **`main`** du dépôt principal (`/Users/sandramarino/reservation-ateliers/`). Ne jamais toucher aux worktrees (`.claude/worktrees/`). Ne jamais déployer une autre branche. `main` = seule source de vérité.

---

## Description du projet

Site web de **réservation d'ateliers créatifs** (poterie, aquarelle, etc.).
Les visiteurs voient un calendrier, cliquent sur un jour avec des ateliers disponibles, et réservent leur place.

- **Frontend** : HTML + CSS + JS vanilla (aucun framework)
- **Backend** : Google Apps Script (lié à une Google Sheet)
- **Base de données** : Google Sheets (deux onglets : Ateliers + Réservations)
- **Hébergement frontend** : GitHub Pages → https://sandra83100.github.io/reservation/

---

## Fichiers du projet

```
reservation-ateliers/
├── CLAUDE.md          ← ce fichier (contexte Claude Code)
├── README.md          ← documentation générale
├── ARCHITECTURE.md    ← détails techniques approfondis
├── index.html         ← page unique (SPA)
├── style.css          ← tous les styles (CSS variables, responsive)
├── script.js          ← logique frontend (calendrier, ateliers, formulaire)
├── Code.gs            ← script Google Apps Script (backend API)
└── .claude/
    └── launch.json    ← config serveur de dev (npx serve, port 3000)
```

---

## URL Apps Script déployée

```
https://script.google.com/macros/s/AKfycbwXsam9kpgaGdwVbf0LYkqBpgFayk9dexy6y2CyeSvwVqvWB-SMGbrDF5Hn4m2AJKoB/exec
```

Cette URL est définie dans `script.js` ligne 4 (`APPS_SCRIPT_URL`).
**À chaque modification de `Code.gs`, il faut redéployer le script et potentiellement mettre à jour cette URL.**

---

## Structure Google Sheets

### Onglet "Ateliers"
| Nom de l'atelier | Date | Heure début | Heure fin | Nb places max |
|-----------------|------|-------------|-----------|---------------|
| Poterie         | ...  | 10:00       | 12:30     | 8             |

### Onglet "Réservations"
| # | Atelier | Date | Heure début | Heure fin | Nom / Prénom | Email | Téléphone | ID Atelier | Soumis le |

**ID Atelier** = numéro de ligne dans l'onglet Ateliers (sans l'en-tête). Utilisé pour compter les réservations par atelier.

---

## Flux utilisateur

1. **Calendrier** → jours avec ateliers disponibles surlignés en bleu avec un point vert
2. **Clic sur un jour** → liste des ateliers du jour avec badge places (dispo / dernières places / complet)
3. **Clic "Réserver"** → formulaire (nom, email, téléphone)
4. **Soumission** → POST vers Apps Script → écriture dans Sheets → message de confirmation

---

## Lancer le serveur de dev

```bash
# Depuis le dossier du projet :
npx serve -p 3000 .
# Puis ouvrir http://localhost:3000
```

Ou utiliser la commande Claude Code : preview_start "site-ateliers"

---

## État du déploiement (3 mars 2026)

- **GitHub Pages** : https://sandra83100.github.io/reservation/ (branche `main`)
- **Apps Script** : Version 19 déployée (3 mars 2026, 23:21)
- **Nom du projet Apps Script** : "Réservation Ateliers Écoferme"
- **Branche unique** : tout le travail est sur `main`

### ⚠️ Déploiement Apps Script — procédure fiable
Le déploiement **ACTIF** est listé sous **"Sans titre"** dans la section Actif (il était nommé "Fix comptage place..." dans les versions précédentes). Il utilise toujours la même URL. Pour déployer une nouvelle version :
1. Déployer → Gérer les déploiements
2. Cliquer sur **"Sans titre"** dans la liste "Actif"
3. Cliquer le **crayon** (Modifier)
4. Ouvrir le dropdown **Version** → sélectionner **"Nouvelle version"**
5. Cliquer **Déployer** immédiatement (sans cliquer ailleurs)
6. Vérifier que la confirmation affiche un nouveau numéro de version

---

## Ce qui est fait (état au 3 mars 2026)

- [x] Structure HTML complète (cartes ateliers / formulaire / confirmation)
- [x] CSS complet avec variables, responsive mobile, animations
- [x] Affichage des ateliers sous forme de **cartes par type** (Rencontre animaux, Mémoires écoferme…)
- [x] Badge **Gratuit** pastille vert foncé `#1F6B2E` sur chaque carte (sans emoji ticket) — ou prix si payant
- [x] Dates en **noms complets** : "Mercredi 4 mars" (pas d'abréviation)
- [x] Badge disponibilité : vert (dispo) / orange (⚡ dernières places) / rouge (complet) — affiche "X places restantes"
- [x] Chargement des ateliers via GET Apps Script (avec fallback DONNEES_TEST en local)
- [x] Formulaire de réservation avec validation côté client
- [x] Section spéciale **Rencontre avec les animaux** : stepper enfants, alerte adulte accompagnant
- [x] Bloc **RGPD** en accordéon dépliable
- [x] Soumission POST vers Apps Script
- [x] Mise à jour optimiste du compteur local après réservation
- [x] **Carousel** sur "Rencontre avec les animaux" : 8 photos réelles (Fine1–3, bassecour1–2, chevre1–2, lapine), rotation 5s, dots de navigation — dossier `images/animaux/`
- [x] **Photos plus hautes** : aspect-ratio 16/12 sur les 3 ateliers
- [x] **Dates disponibles** : bloc agrandi +30% (icône + texte)
- [x] **Confirmation par email** HTML automatique via MailApp
- [x] **Autorisation MailApp** accordée
- [x] **Anti-doublon** : même email ne peut pas réserver deux fois le même atelier
- [x] **Comptage places** : somme `Nb personnes` (colonne K) au lieu de compter les lignes
- [x] Code.gs : doGet (liste ateliers + places restantes + annulation + **ICS**), doPost (enregistrement réservation)
- [x] Code.gs : `dateToGcal()` pour URL Google Calendar, `handleAnnulation()` page HTML
- [x] Code.gs : `generateIcs()` → endpoint `?action=ics&id=X` — fichier `.ics` pour Apple Calendar / Outlook
- [x] Code.gs : initialiserSheet(), menu personnalisé onOpen()
- [x] Zébrage automatique (11 colonnes), protection XSS escapeHtml()
- [x] **Déploiement GitHub Pages** : https://sandra83100.github.io/reservation/ (branche main)
- [x] SHEET_ID : `1x6_cgQwlZaY6p8wAr6_VtGjdRiuEjWpnMWvUAh-Rh1k`

### Header page catalogue (3 mars 2026)
- [x] **Logo** : balise `<img src="logo-ecoferme.png">` centrée au-dessus du titre (fichier PNG à déposer à la racine)
- [x] **Bandeau "Ateliers gratuits · Entrée libre"** supprimé
- [x] **Sous-titre** mis à jour : "ateliers 100% gratuits, réservez votre place en quelques clics !"

### Email v19 (3 mars 2026)
- [x] Police Arial/sans-serif partout
- [x] Date lisible "Mercredi 4 mars 2026"
- [x] Palette vert foncé #1F6B2E
- [x] Encart atelier (nom + date + heure)
- [x] **Agenda 3 choix** : 📅 Google Agenda / 🍎 Apple Calendar / 📥 Autre–Outlook (liens ICS dynamiques)
- [x] Bouton **✖ Annuler ma réservation** (token base64 `email|atelierId`, page HTML de confirmation)
- [x] **Participants** : détail "1 adulte et X enfants — tranche d'âge" pour tous les ateliers (plus limité à Rencontre animaux)
- [x] 📞 04 98 00 95 70 cliquable (`tel:+33498009570`)
- [x] 📍 55 allée Georges Leygues (texte) → lien Maps vers 265 allée (accès réel)
- [x] **Logo** dans le bandeau vert header email — placeholder `https://URL-DU-LOGO-A-REMPLACER.png` à remplacer avec URL WordPress
- [x] Bouton Facebook "Suivez notre actualité sur Facebook"
- [x] Footer : coordonnées + Facebook + séparateur + mention auto

---

## Points d'attention / À faire

- [ ] **Logo** : déposer `logo-ecoferme.png` à la racine du projet (page catalogue) ET fournir l'URL WordPress pour le header de l'email (remplacer `https://URL-DU-LOGO-A-REMPLACER.png` dans `Code.gs` puis redéployer)
- [ ] **Descriptions réelles** à remplacer (actuellement Lorem ipsum sur toutes les cartes)
- [ ] Pas d'admin pour gérer les ateliers depuis le site (tout passe par Google Sheets directement)
- [ ] Pas de confirmation par SMS
- [ ] Pas de système de liste d'attente

## ⚠️ Attention au cache navigateur

Le preview local peut afficher une vieille version JS. Si les changements n'apparaissent pas :
```js
// Dans la console du navigateur :
window.location.href = window.location.origin + '/?v=' + Date.now()
```

---

## Palette de couleurs (CSS variables)

| Variable       | Valeur    | Usage                    |
|---------------|-----------|--------------------------|
| `--bleu`      | `#4A6FA5` | Principal, header, liens |
| `--bleu-clair`| `#E8EFF8` | Fonds, hover             |
| `--vert`      | `#2E7D32` | Confirmation, dispo      |
| `--rouge`     | `#C62828` | Erreurs, complet         |
| `--gris`      | `#9E9E9E` | Inactif, désactivé       |

---

## Conventions de code

- **JS** : fonctions nommées en camelCase français (ex: `chargerAteliers`, `ouvrirFormulaire`)
- **CSS** : classes BEM simplifié (ex: `.atelier-card`, `.atelier-card.complet`)
- **Google Apps Script** : fonctions en camelCase (ex: `doGet`, `doPost`, `sheetToObjects`)
- Pas de framework JS, pas de build step, tout est vanilla
