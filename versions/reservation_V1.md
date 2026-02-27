# Version 1 — Design vert "Écoferme" avec cartes
> Sauvegarde du 27 février 2026

## État du design

**Thème** : Vert nature / Écoferme
**Layout** : Cartes (pas de calendrier)
**Fichiers sources** : `index.html`, `style.css`, `script.js` (à la racine du worktree)

## Palette de couleurs

| Variable             | Valeur     | Usage                        |
|---------------------|------------|------------------------------|
| `--vert-primaire`   | `#3A7D44`  | Titres, liens, accents       |
| `--vert-fonce`      | `#2A5C30`  | Header, fond principal       |
| `--vert-hover`      | `#2E6B35`  | Hover boutons                |
| `--vert-clair`      | `#C8E6C9`  | Bordures, fonds légers       |
| `--vert-bg`         | `#EEF5EC`  | Fond page                    |
| `--vert-dates-bg`   | `#F0F8F0`  | Fond section dates           |
| `--vert-dates-brd`  | `#B8DCB8`  | Bordures section dates       |
| `--ambre`           | `#E8920A`  | Badge "dernières places"     |
| `--ambre-clair`     | `#FEF3DC`  | Fond badge ambre             |
| `--texte`           | `#1B3A21`  | Texte principal              |
| `--texte-doux`      | `#4D6E52`  | Texte secondaire             |
| `--rouge`           | `#C62828`  | Erreurs, complet             |

## Structure HTML

- **Header** : `🌿 Nos ateliers` — "Venez vivre une expérience unique au cœur de la nature"
- **Section cartes** (`#cartes-section`) : grille de `article.carte-atelier`
- **Section formulaire** (`#formulaire-section`) : prénom, email, téléphone, nb participants, RGPD
- **Section confirmation** (`#confirmation-section`) : message + bouton nouvelle résa

## Structure d'une carte atelier

```
article.carte-atelier
  div.carte-photo
    img (photo picsum.photos)
    span.carte-badge (icône + nb places max)
  div.carte-corps
    h2.carte-titre
    p.carte-description
    div.carte-dates
      p.carte-dates-titre ("📅 Dates disponibles")
      div.carte-dates-liste
        button.carte-date-btn.dispo | .derniere | .complet
```

## Ateliers configurés (CONFIG_ATELIERS dans script.js)

| Nom                              | Photo seed    |
|----------------------------------|---------------|
| Rencontre avec les animaux       | animaux42     |
| Mémoires de l'écoferme           | ferme77       |
| Visite découverte de l'Écoferme  | ecoferme33    |

## Fonctionnalités

- Chargement ateliers via GET Apps Script (`?action=getAteliers`)
- Regroupement par type d'atelier (plusieurs dates par carte)
- Badges disponibilité : vert (dispo) / ambre (dernières places ≤ 2) / rouge (complet)
- Formulaire : prénom, email, téléphone, nb participants
- Bloc RGPD obligatoire
- Soumission POST vers Apps Script
- Confirmation finale avec message personnalisé

## URL Apps Script

```
https://script.google.com/macros/s/AKfycbwXsam9kpgaGdwVbf0LYkqBpgFayk9dexy6y2CyeSvwVqvWB-SMGbrDF5Hn4m2AJKoB/exec
```

## Pour reprendre

```bash
# Lancer le serveur
preview_start "site-ateliers"   # ou : python3 -m http.server 3000

# Fichiers à modifier
style.css   → design / couleurs
index.html  → structure
script.js   → logique (CONFIG_ATELIERS pour photos/descriptions)
```

## Prochaines versions possibles

- [ ] V2 : ...
