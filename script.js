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
    console.error('Erreur chargement ateliers :', err);
    afficherErreurGlobale('Impossible de charger les ateliers. Vérifiez votre connexion.');
    renderCartes();
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

/** Convertit "DD/MM/YYYY" en "Mer. 4 mars" */
function formatDateLisible(dateStr) {
  const [dd, mm, yyyy] = dateStr.split('/');
  const date = new Date(yyyy, mm - 1, dd);
  const jours = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];
  const mois  = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
                  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  return `${jours[date.getDay()]} ${date.getDate()} ${mois[date.getMonth()]}`;
}

// ============================================================
//  FORMULAIRE
// ============================================================
function ouvrirFormulaire(atelier) {
  atelierSelectionne = atelier;

  document.getElementById('recap-atelier').innerHTML = `
    <strong>${escapeHtml(atelier.nom)}</strong>
    📅 ${formatDateLisible(atelier.date)} &nbsp;|&nbsp; 🕐 ${atelier.debut} – ${atelier.fin}
    &nbsp;|&nbsp; <span class="atelier-places dispo">${atelier.placesRestantes} place${atelier.placesRestantes > 1 ? 's' : ''} disponible${atelier.placesRestantes > 1 ? 's' : ''}</span>
  `;

  document.getElementById('form-reservation').reset();
  effacerErreurs();
  afficherSection('formulaire');
}

async function soumettreReservation(e) {
  e.preventDefault();

  const nom   = document.getElementById('nom').value.trim();
  const email = document.getElementById('email').value.trim();
  const tel   = document.getElementById('tel').value.trim();

  let valide = true;
  if (!nom)                     { afficherErreurChamp('nom',   'Veuillez saisir votre nom et prénom.'); valide = false; }
  if (!email || !isEmailValide(email)) { afficherErreurChamp('email', 'Adresse email invalide.'); valide = false; }
  if (!tel)                     { afficherErreurChamp('tel',   'Veuillez saisir votre téléphone.'); valide = false; }
  if (!valide) return;

  setBoutonConfirmer(true);

  try {
    const resp = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ atelierId: atelierSelectionne.id, nom, email, tel })
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
  ['nom', 'email', 'tel'].forEach(id => {
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
