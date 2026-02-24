# Réservation d'ateliers

Site web de réservation de places pour des ateliers créatifs (poterie, aquarelle, etc.).

## Fonctionnement

1. Les ateliers sont gérés dans une **Google Sheet** (ajout/modification directement dans le tableau)
2. Le site affiche un **calendrier** avec les jours ayant des ateliers disponibles
3. Les visiteurs choisissent un atelier et remplissent un **formulaire** (nom, email, téléphone)
4. La réservation est enregistrée automatiquement dans la Google Sheet

## Stack technique

| Composant | Technologie |
|-----------|-------------|
| Frontend | HTML + CSS + JavaScript vanilla |
| Backend | Google Apps Script |
| Base de données | Google Sheets |
| Serveur de dev | `npx serve` |

## Démarrage rapide

```bash
# Lancer le serveur local
npx serve -p 3000 .
# Ouvrir http://localhost:3000
```

## Structure des fichiers

```
├── index.html    → Page unique (structure HTML)
├── style.css     → Styles (variables CSS, responsive)
├── script.js     → Logique frontend
└── Code.gs       → Backend Google Apps Script
```

## Configuration Google Sheets

La Google Sheet doit avoir **deux onglets** :

### "Ateliers" (rempli manuellement)
- `Nom de l'atelier`
- `Date` (format DD/MM/YYYY)
- `Heure début` (ex: 10:00)
- `Heure fin` (ex: 12:30)
- `Nb places max`

### "Réservations" (rempli automatiquement)
Toutes les réservations reçues s'ajoutent ici automatiquement.

> Pour initialiser les onglets avec la mise en forme : ouvrir la Sheet → menu **Ateliers** → **Initialiser les onglets**

## Déploiement du backend (Apps Script)

1. Ouvrir la Google Sheet liée
2. **Extensions** → **Apps Script**
3. Coller le contenu de `Code.gs`
4. **Déployer** → **Nouveau déploiement** → Type : Application Web
   - Exécuter en tant que : **Moi**
   - Accès : **Tout le monde**
5. Copier l'URL et la coller dans `script.js` ligne 4 (`APPS_SCRIPT_URL`)

## URL Apps Script actuelle

```
https://script.google.com/macros/s/AKfycbwXsam9kpgaGdwVbf0LYkqBpgFayk9dexy6y2CyeSvwVqvWB-SMGbrDF5Hn4m2AJKoB/exec
```
