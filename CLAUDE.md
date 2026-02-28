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

## État du déploiement (28 février 2026)

- **GitHub Pages** : https://sandra83100.github.io/reservation/ (branche `main`)
- **Apps Script** : Version 10 déployée — MailApp autorisée, emails de confirmation opérationnels
- **Nom du projet Apps Script** : "Réservation Ateliers Écoferme" (renommé depuis "Projet sans titre")
- **Branche unique** : tout le travail est sur `main`, les autres branches (`lucid-dubinsky`, `musing-dirac`) sont obsolètes

---

## Ce qui est fait (état au 28 février 2026)

- [x] Structure HTML complète (cartes ateliers / formulaire / confirmation)
- [x] CSS complet avec variables, responsive mobile, animations
- [x] Affichage des ateliers sous forme de **cartes par type** (Rencontre animaux, Mémoires écoferme…)
- [x] Badge **🎟 Gratuit** sur chaque carte (ou prix si payant)
- [x] Dates en **noms complets** : "Mercredi 4 mars" (pas d'abréviation)
- [x] Badge disponibilité : vert (dispo) / orange (⚡ dernières places) / rouge (complet)
- [x] Chargement des ateliers via GET Apps Script (avec fallback DONNEES_TEST en local)
- [x] Formulaire de réservation avec validation côté client
- [x] Section spéciale **Rencontre avec les animaux** : stepper enfants, alerte adulte accompagnant
- [x] Bloc **RGPD** en accordéon dépliable
- [x] Soumission POST vers Apps Script
- [x] Mise à jour optimiste du compteur local après réservation
- [x] **Confirmation par email** HTML automatique (style Écoferme vert) via MailApp
- [x] **Autorisation MailApp** accordée — emails envoyés automatiquement après chaque réservation
- [x] **Anti-doublon** : même email ne peut pas réserver deux fois le même atelier
- [x] Code.gs : doGet (liste ateliers + places restantes), doPost (enregistrement réservation)
- [x] Code.gs : initialiserSheet() pour créer les onglets avec mise en forme
- [x] Code.gs : menu personnalisé dans Google Sheets (onOpen)
- [x] Zébrage automatique des nouvelles lignes de réservation
- [x] Protection XSS via escapeHtml()
- [x] **Déploiement GitHub Pages** : https://sandra83100.github.io/reservation/ (branche main)
- [x] SHEET_ID défini dans Code.gs : `1x6_cgQwlZaY6p8wAr6_VtGjdRiuEjWpnMWvUAh-Rh1k`
- [x] Projet Apps Script renommé : "Réservation Ateliers Écoferme"

---

## Points d'attention / À faire

- [ ] **Photos et descriptions réelles** à remplacer (actuellement : picsum.photos + Lorem ipsum)
- [ ] **Badge places** : affiche "8/8 places" même quand tout est dispo — envisager de masquer ou reformuler quand toutes les places sont libres (ex: "Places disponibles")
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
