// ============================================================
//  CONFIGURATION
// ============================================================
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwXsam9kpgaGdwVbf0LYkqBpgFayk9dexy6y2CyeSvwVqvWB-SMGbrDF5Hn4m2AJKoB/exec';

// Config visuelle par type d'atelier (photo + description)
const CONFIG_ATELIERS = {
  'Rencontre avec les animaux': {
    photo: 'https://picsum.photos/seed/animaux42/700/400',
    description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco.'
  },
  'Mémoires de l\'écoferme': {
    photo: 'https://picsum.photos/seed/ferme77/700/400',
    description: 'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia.'
  },
  'Visite découverte de l\'Écoferme': {
    photo: 'https://picsum.photos/seed/ecoferme33/700/400',
    description: 'Ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit.'
  }
};

// ============================================================
//  DONNÉES DE TEST (utilisées automatiquement en local)
// ============================================================
const DONNEES_TEST = [
  { id: 1, nom: 'Rencontre avec les animaux',      date: '15/03/2026', debut: '10:00', fin: '12:00', placesMax: 8,  placesRestantes: 5 },
  { id: 2, nom: 'Rencontre avec les animaux',      date: '22/03/2026', debut: '10:00', fin: '12:00', placesMax: 8,  placesRestantes: 2 },
  { id: 3, nom: "Mémoires de l'écoferme",          date: '18/03/2026', debut: '14:00', fin: '16:30', placesMax: 10, placesRestantes: 10 },
  { id: 4, nom: "Visite découverte de l'Écoferme", date: '20/03/2026', debut: '09:30', fin: '11:30', placesMax: 12, placesRestantes: 0 },
  { id: 5, nom: "Visite découverte de l'Écoferme", date: '27/03/2026', debut: '09:30', fin: '11:30', placesMax: 12, placesRestantes: 7 },
];

// ============================================================
//  ÉTAT GLOBAL
// ============================================================
let ateliers = [];
let atelierSelectionne = null;

// ============================================================
//  INITIALISATION
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  chargerAteliers();
});

function bindEvents() {
  document.getElementById('btn-annuler').addEventListener('click', () => afficherSection('cartes'));
  document.getElementById('btn-nouvelle-resa').addEventListener('click', () => {
    atelierSelectionne = null;
    afficherSection('cartes');
  });
  document.getElementById('btn-reessayer').addEventListener('click', () => {
    masquerErreurGlobale();
    chargerAteliers();
  });
  document.getElementById('form-reservation').addEventListener('submit', soumettreReservation);
  document.getElementById('nb-enfants').addEventListener('change', genererAgesEnfants);
}

// ============================================================
//  CHARGEMENT DES ATELIERS
// ============================================================
async function chargerAteliers() {
  afficherLoader(true);
  masquerErreurGlobale();
  try {
    const resp = await fetch(`${APPS_SCRIPT_URL}?action=getAteliers`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    if (data.error) throw new Error(data.error);
    ateliers = data;
    renderCartes();
  } catch (err) {
    const estEnLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
    if (estEnLocal) {
      console.warn('API indisponible en local → données de test chargées.');
      ateliers = DONNEES_TEST;
      renderCartes();
    } else {
      console.error('Erreur chargement ateliers :', err);
      afficherErreurGlobale('Impossible de charger les ateliers. Vérifiez votre connexion.');
      renderCartes();
    }
  } finally {
    afficherLoader(false);
  }
}

// ============================================================
//  RENDU DES CARTES PAR TYPE D'ATELIER
// ============================================================
function renderCartes() {
  const conteneur = document.getElementById('cartes-ateliers');
  conteneur.innerHTML = '';

  // Grouper par nom d'atelier
  const parType = {};
  ateliers.forEach(a => {
    if (!parType[a.nom]) parType[a.nom] = [];
    parType[a.nom].push(a);
  });

  if (Object.keys(parType).length === 0) {
    conteneur.innerHTML = '<p class="cartes-vide">Aucun atelier disponible pour le moment.</p>';
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  Object.entries(parType).forEach(([nom, slots]) => {
    const cfg = CONFIG_ATELIERS[nom] || {
      photo: 'https://picsum.photos/seed/atelier/700/400',
      description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.'
    };

    const placesMax = slots[0]?.placesMax || 8;

    // Filtrer les créneaux futurs avec places disponibles
    const slotsDispos = slots.filter(a => {
      const [dd, mm, yyyy] = a.date.split('/');
      const dateAtelier = new Date(yyyy, mm - 1, dd);
      return dateAtelier >= today && a.placesRestantes > 0;
    });

    const carte = document.createElement('article');
    carte.className = 'carte-atelier';

    carte.innerHTML = `
      <div class="carte-photo">
        <img src="${cfg.photo}" alt="${escapeHtml(nom)}" loading="lazy" />
        <span class="carte-badge">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink:0">
            <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
          </svg>
          ${placesMax} places
        </span>
      </div>
      <div class="carte-corps">
        <h2 class="carte-titre">${escapeHtml(nom)}</h2>
        <p class="carte-description">${cfg.description}</p>
        <div class="carte-dates">
          <p class="carte-dates-titre">📅 Dates disponibles</p>
          ${slotsDispos.length === 0
            ? '<p class="carte-complet">Toutes les sessions sont actuellement complètes.</p>'
            : slotsDispos.map(a => {
                const badgeClass = a.placesRestantes <= 2 ? 'last' : 'dispo';
                const badgeTexte = a.placesRestantes <= 2
                  ? `⚡ ${a.placesRestantes} place${a.placesRestantes > 1 ? 's' : ''} restante${a.placesRestantes > 1 ? 's' : ''}`
                  : `${a.placesRestantes}/${a.placesMax} places`;
                return `
                  <div class="carte-slot">
                    <div class="slot-info">
                      <span class="slot-date">${formatDateLisible(a.date)}</span>
                      <span class="slot-horaire">🕐 ${a.debut} – ${a.fin}</span>
                      <span class="slot-places ${badgeClass}">${badgeTexte}</span>
                    </div>
                    <button class="btn-reserver-slot" data-id="${a.id}">Réserver</button>
                  </div>
                `;
              }).join('')
          }
        </div>
      </div>
    `;

    // Attacher les événements sur chaque bouton Réserver
    slotsDispos.forEach(a => {
      const btn = carte.querySelector(`[data-id="${a.id}"]`);
      if (btn) btn.addEventListener('click', () => ouvrirFormulaire(a));
    });

    conteneur.appendChild(carte);
  });
}

/** Convertit "DD/MM/YYYY" en "Mercredi 4 mars" */
function formatDateLisible(dateStr) {
  const [dd, mm, yyyy] = dateStr.split('/');
  const date = new Date(yyyy, mm - 1, dd);
  const jours = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const mois  = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
                  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  return `${jours[date.getDay()]} ${date.getDate()} ${mois[date.getMonth()]}`;
}

// ============================================================
//  FORMULAIRE
// ============================================================
const NOM_ATELIER_ANIMAUX = 'Rencontre avec les animaux';

function ouvrirFormulaire(atelier) {
  atelierSelectionne = atelier;

  document.getElementById('recap-atelier').innerHTML = `
    <strong>${escapeHtml(atelier.nom)}</strong>
    📅 ${formatDateLisible(atelier.date)} &nbsp;|&nbsp; 🕐 ${atelier.debut} – ${atelier.fin}
    &nbsp;|&nbsp; <span class="atelier-places dispo">${atelier.placesRestantes} place${atelier.placesRestantes > 1 ? 's' : ''} disponible${atelier.placesRestantes > 1 ? 's' : ''}</span>
  `;

  document.getElementById('form-reservation').reset();
  effacerErreurs();

  // Afficher la section adaptée selon l'atelier
  const estAnimaux = atelier.nom === NOM_ATELIER_ANIMAUX;
  document.getElementById('champ-nb-personnes').classList.toggle('hidden', estAnimaux);
  document.getElementById('section-animaux').classList.toggle('hidden', !estAnimaux);
  document.getElementById('ages-enfants').innerHTML = '';

  afficherSection('formulaire');
}

function genererAgesEnfants() {
  const nb = parseInt(document.getElementById('nb-enfants').value) || 0;
  const conteneur = document.getElementById('ages-enfants');
  conteneur.innerHTML = '';
  for (let i = 1; i <= nb; i++) {
    const div = document.createElement('div');
    div.className = 'champ champ-age-enfant';
    div.innerHTML = `
      <label for="age-enfant-${i}">
        Âge de l'enfant ${i} <span class="obligatoire">*</span>
      </label>
      <select id="age-enfant-${i}" name="ageEnfant${i}">
        <option value="">-- Choisir --</option>
        <option value="moins-3ans">Moins de 3 ans</option>
        <option value="3-10ans">3 à 10 ans</option>
        <option value="plus-10ans">Plus de 10 ans</option>
      </select>
      <span class="erreur-champ" id="erreur-age-enfant-${i}"></span>
    `;
    conteneur.appendChild(div);
  }
}

async function soumettreReservation(e) {
  e.preventDefault();

  const nom   = document.getElementById('prenom').value.trim();
  const email = document.getElementById('email').value.trim();
  const tel   = document.getElementById('tel').value.trim();

  let valide = true;
  if (!nom)                          { afficherErreurChamp('prenom', 'Veuillez saisir votre prénom.'); valide = false; }
  if (!email || !isEmailValide(email)) { afficherErreurChamp('email',  'Adresse email invalide.'); valide = false; }
  if (!tel)                          { afficherErreurChamp('tel',    'Veuillez saisir votre téléphone.'); valide = false; }

  // Calcul du nombre de participants selon l'atelier
  let nbPersonnes = 0;
  const estAnimaux = atelierSelectionne.nom === NOM_ATELIER_ANIMAUX;

  if (estAnimaux) {
    const nbEnfants = parseInt(document.getElementById('nb-enfants').value) || 0;
    if (!nbEnfants) {
      afficherErreurChamp('nb-enfants', 'Veuillez indiquer le nombre d\'enfants.');
      valide = false;
    } else {
      // Valider l'âge de chaque enfant
      for (let i = 1; i <= nbEnfants; i++) {
        const sel = document.getElementById(`age-enfant-${i}`);
        if (!sel || !sel.value) {
          afficherErreurChamp(`age-enfant-${i}`, 'Veuillez indiquer l\'âge de cet enfant.');
          valide = false;
        }
      }
      nbPersonnes = nbEnfants + 1; // enfants + 1 adulte obligatoire
    }
  } else {
    nbPersonnes = parseInt(document.getElementById('nb-personnes').value) || 0;
    if (!nbPersonnes) {
      afficherErreurChamp('nb-personnes', 'Veuillez indiquer le nombre de participants.');
      valide = false;
    }
  }

  if (!valide) return;

  // Collecter les âges des enfants si atelier animaux
  const agesEnfants = [];
  if (estAnimaux) {
    const nb = parseInt(document.getElementById('nb-enfants').value);
    for (let i = 1; i <= nb; i++) {
      agesEnfants.push(document.getElementById(`age-enfant-${i}`).value);
    }
  }

  setBoutonConfirmer(true);

  try {
    const resp = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        atelierId: atelierSelectionne.id,
        nom, email, tel,
        nbPersonnes,
        ...(estAnimaux && { agesEnfants })
      })
    });
    const data = await resp.json();

    if (data.error) {
      afficherErreurGlobale(data.error);
      setBoutonConfirmer(false);
      return;
    }

    document.getElementById('confirmation-message').textContent =
      data.message || 'Votre réservation a bien été enregistrée.';

    // Mettre à jour le compteur local
    const a = ateliers.find(x => x.id === atelierSelectionne.id);
    if (a) a.placesRestantes = Math.max(0, a.placesRestantes - 1);

    afficherSection('confirmation');

  } catch (err) {
    console.error('Erreur envoi :', err);
    afficherErreurGlobale('Une erreur est survenue. Veuillez réessayer.');
    setBoutonConfirmer(false);
  }
}

// ============================================================
//  NAVIGATION
// ============================================================
function afficherSection(section) {
  document.getElementById('cartes-section').classList.add('hidden');
  document.getElementById('formulaire-section').classList.add('hidden');
  document.getElementById('confirmation-section').classList.add('hidden');

  switch (section) {
    case 'cartes':
      renderCartes();
      document.getElementById('cartes-section').classList.remove('hidden');
      break;
    case 'formulaire':
      document.getElementById('formulaire-section').classList.remove('hidden');
      break;
    case 'confirmation':
      document.getElementById('confirmation-section').classList.remove('hidden');
      break;
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================================
//  UTILITAIRES UI
// ============================================================
function afficherLoader(visible) {
  document.getElementById('loader').classList.toggle('hidden', !visible);
}

function afficherErreurGlobale(msg) {
  document.getElementById('erreur-globale-message').textContent = msg;
  document.getElementById('erreur-globale').classList.remove('hidden');
}

function masquerErreurGlobale() {
  document.getElementById('erreur-globale').classList.add('hidden');
}

function afficherErreurChamp(champ, msg) {
  document.getElementById(champ).classList.add('invalide');
  document.getElementById(`erreur-${champ}`).textContent = msg;
}

function effacerErreurs() {
  ['prenom', 'email', 'tel'].forEach(id => {
    document.getElementById(id).classList.remove('invalide');
    document.getElementById(`erreur-${id}`).textContent = '';
  });
}

function setBoutonConfirmer(enCours) {
  const btn = document.getElementById('btn-confirmer');
  document.getElementById('btn-confirmer-texte').classList.toggle('hidden', enCours);
  document.getElementById('btn-confirmer-loader').classList.toggle('hidden', !enCours);
  btn.disabled = enCours;
}

function isEmailValide(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
