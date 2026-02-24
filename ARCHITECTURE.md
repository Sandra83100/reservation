# Architecture technique — Réservation d'ateliers

## Vue d'ensemble

```
[Navigateur]
    │
    ├── index.html  (structure)
    ├── style.css   (apparence)
    └── script.js   (logique)
         │
         │  GET  ?action=getAteliers
         │  POST { atelierId, nom, email, tel }
         ▼
    [Google Apps Script — Code.gs]
         │
         │  SpreadsheetApp
         ▼
    [Google Sheets]
         ├── Onglet "Ateliers"      (données source)
         └── Onglet "Réservations"  (données écrites)
```

---

## Frontend — script.js

### État global
```js
let ateliers = [];          // Tableau brut venu de l'API
let ateliersParDate = {};   // Index { "DD/MM/YYYY": [atelier, ...] }
let dateSelectionnee = null;
let atelierSelectionne = null;
let moisCourant, anneeCourante;
```

### Flux d'initialisation
```
DOMContentLoaded
  → bindEvents()        (attache tous les écouteurs)
  → chargerAteliers()   (GET API → ateliers[] → indexerAteliersParDate() → renderCalendrier())
```

### Navigation entre sections
4 sections HTML, une seule visible à la fois via la classe `.hidden` :
- `calendrier-section`
- `ateliers-section`
- `formulaire-section`
- `confirmation-section`

Fonction centrale : `afficherSection(section)` — masque tout, affiche la bonne.

### Rendu du calendrier
`renderCalendrier()` :
1. Calcule le décalage du 1er jour du mois (semaine commence lundi)
2. Pour chaque jour : vérifie si `ateliersParDate[dateStr]` existe avec `placesRestantes > 0`
3. Ajoute la classe `.actif` (clickable) ou `.inactif` selon le résultat
4. Ajoute `.aujourdhui` si c'est aujourd'hui
5. Ajoute `.selectionne` si c'est la date actuellement sélectionnée

### Badges de disponibilité
| Condition | Classe CSS | Affichage |
|-----------|-----------|-----------|
| places > 2 | `.dispo` | "X/Y places" |
| places = 1 ou 2 | `.last` | "Plus que X place(s) !" |
| places = 0 | `.complet` | "Complet" |

### Soumission du formulaire
```
soumettreReservation()
  → validation client (nom, email regex, tel)
  → POST JSON vers APPS_SCRIPT_URL
  → réponse { success, message } ou { error }
  → si succès : décrémente placesRestantes localement + afficherSection('confirmation')
```

---

## Backend — Code.gs

### Endpoints

#### GET `?action=getAteliers`
Retourne la liste des ateliers avec calcul des places restantes :
```json
[
  {
    "id": 1,
    "nom": "Poterie",
    "date": "15/03/2026",
    "debut": "10:00",
    "fin": "12:30",
    "placesMax": 8,
    "placesRestantes": 5
  }
]
```

**Calcul places restantes** :
- Compte les entrées dans l'onglet Réservations où `ID Atelier = id`
- `placesRestantes = max(0, placesMax - count)`

#### POST (body JSON)
```json
{ "atelierId": 1, "nom": "Marie Dupont", "email": "marie@email.com", "tel": "0612345678" }
```

Validations :
1. Tous les champs présents
2. Atelier existe (via getAteliers)
3. Places restantes > 0

Écriture dans Réservations :
```
[#auto, nomAtelier, date, heureDebut, heureFin, nom, email, tel, atelierId, timestamp]
```

### Utilitaires
- `sheetToObjects(sheet)` → transforme un onglet Sheet en tableau d'objets JS (clé = nom de colonne)
- `formatDate(d)` → Date JS → "DD/MM/YYYY"
- `formatTime(val)` → Date ou string → "HH:MM"
- `appliquerZebrage(sheet, rowIndex)` → couleur alternée sur nouvelles lignes

### Initialisation (à lancer une fois)
`initialiserSheet()` → appelé via menu Sheets → crée les deux onglets avec en-têtes et mise en forme.

---

## CSS — style.css

### Variables CSS (`:root`)
```css
--bleu: #4A6FA5        /* couleur principale */
--bleu-clair: #E8EFF8  /* fonds clairs */
--vert: #2E7D32        /* succès, disponible */
--rouge: #C62828       /* erreur, complet */
--gris: #9E9E9E        /* inactif */
--rayon: 10px          /* border-radius standard */
--ombre: 0 2px 8px rgba(0,0,0,.10)
--transition: 0.18s ease
```

### Breakpoint responsive
`@media (max-width: 480px)` → layout colonne, boutons pleine largeur

### Classe utilitaire
`.hidden { display: none !important; }` — utilisée massivement pour la navigation entre sections

---

## Points importants pour les modifications futures

### Ajouter un champ au formulaire
1. Ajouter l'input dans `index.html` (dans `#form-reservation`)
2. Ajouter la validation dans `soumettreReservation()` dans `script.js`
3. Ajouter le champ dans le payload JSON envoyé en POST
4. Dans `Code.gs` : déstructurer le nouveau champ dans `doPost()` et l'ajouter dans `sheet.appendRow()`
5. Ajouter la colonne correspondante dans l'onglet Réservations (et mettre à jour `creerOngletReservations`)

### Modifier les ateliers
Directement dans Google Sheets → onglet "Ateliers". Le site se met à jour au prochain chargement.

### Redéployer Code.gs
Après modification de `Code.gs` :
1. Apps Script → Déployer → Gérer les déploiements
2. Modifier le déploiement existant (nouvelle version)
3. L'URL reste la même si on modifie un déploiement existant (ne pas créer un nouveau)

### Format des dates
- Google Sheets stocke les dates comme objets Date
- `formatDate()` dans Code.gs les convertit en "DD/MM/YYYY"
- `formatDate()` dans script.js fait la même chose côté client
- L'index `ateliersParDate` utilise ce format comme clé
