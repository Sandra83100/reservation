// ============================================================
//  CONFIGURATION — ⚠️ Remplacer par l'URL de ton Apps Script
// ============================================================
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwXsam9kpgaGdwVbf0LYkqBpgFayk9dexy6y2CyeSvwVqvWB-SMGbrDF5Hn4m2AJKoB/exec';

// ============================================================
//  ÉTAT GLOBAL
// ============================================================
let ateliers       = [];   // Tous les ateliers chargés depuis la Sheet
let ateliersParDate = {};  // { "DD/MM/YYYY": [atelier, ...] }
let dateSelectionnee = null;
let atelierSelectionne = null;

let moisCourant = new Date().getMonth();
let anneeCourante = new Date().getFullYear();

// ============================================================
//  INITIALISATION
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  chargerAteliers();
});

function bindEvents() {
  document.getElementById('btn-prev').addEventListener('click', () => {
    moisCourant--;
    if (moisCourant < 0) { moisCourant = 11; anneeCourante--; }
    renderCalendrier();
  });

  document.getElementById('btn-next').addEventListener('click', () => {
    moisCourant++;
    if (moisCourant > 11) { moisCourant = 0; anneeCourante++; }
    renderCalendrier();
  });

  document.getElementById('btn-retour').addEventListener('click', () => {
    afficherSection('calendrier');
  });

  document.getElementById('btn-annuler').addEventListener('click', () => {
    afficherSection('ateliers');
  });

  document.getElementById('btn-nouvelle-resa').addEventListener('click', () => {
    atelierSelectionne = null;
    afficherSection('calendrier');
  });

  document.getElementById('btn-reessayer').addEventListener('click', () => {
    masquerErreurGlobale();
    chargerAteliers();
  });

  document.getElementById('form-reservation').addEventListener('submit', soumettreReservation);
}

// ============================================================
//  CHARGEMENT DES ATELIERS (GET)
// ============================================================
async function chargerAteliers() {
  afficherLoader(true);
  masquerErreurGlobale();

  try {
    const url = `${APPS_SCRIPT_URL}?action=getAteliers`;
    const resp = await fetch(url);

    if (!resp.ok) throw new Error(`Erreur HTTP ${resp.status}`);

    const data = await resp.json();

    if (data.error) throw new Error(data.error);

    ateliers = data;
    indexerAteliersParDate();
    renderCalendrier();

  } catch (err) {
    console.error('Erreur chargement ateliers :', err);
    afficherErreurGlobale('Impossible de charger les ateliers. Vérifiez votre connexion.');
    // Affiche quand même le calendrier (vide)
    renderCalendrier();
  } finally {
    afficherLoader(false);
  }
}

/** Crée un index { "DD/MM/YYYY": [atelier, ...] } pour accès rapide */
function indexerAteliersParDate() {
  ateliersParDate = {};
  ateliers.forEach(a => {
    if (!ateliersParDate[a.date]) {
      ateliersParDate[a.date] = [];
    }
    ateliersParDate[a.date].push(a);
  });
}

// ============================================================
//  RENDU DU CALENDRIER
// ============================================================
function renderCalendrier() {
  const moisNoms = [
    'Janvier','Février','Mars','Avril','Mai','Juin',
    'Juillet','Août','Septembre','Octobre','Novembre','Décembre'
  ];

  document.getElementById('mois-titre').textContent =
    `${moisNoms[moisCourant]} ${anneeCourante}`;

  const grille = document.getElementById('calendrier-grille');
  grille.innerHTML = '';

  const aujourd = new Date();
  aujourd.setHours(0, 0, 0, 0);

  // Premier jour du mois (0=Dim, 1=Lun, ... 6=Sam)
  const premierJour = new Date(anneeCourante, moisCourant, 1);
  // Décalage pour commencer lundi (0=lundi ... 6=dimanche)
  let decalage = premierJour.getDay() - 1;
  if (decalage < 0) decalage = 6;

  // Nombre de jours dans le mois
  const nbJours = new Date(anneeCourante, moisCourant + 1, 0).getDate();

  // Cellules vides de début
  for (let i = 0; i < decalage; i++) {
    const vide = document.createElement('div');
    vide.className = 'jour vide';
    grille.appendChild(vide);
  }

  // Jours du mois
  for (let j = 1; j <= nbJours; j++) {
    const date = new Date(anneeCourante, moisCourant, j);
    const dateStr = formatDate(date);

    const div = document.createElement('div');
    div.textContent = j;
    div.className = 'jour';

    const estPasse = date < aujourd;
    const aAteliersDispo = ateliersParDate[dateStr] &&
      ateliersParDate[dateStr].some(a => a.placesRestantes > 0);

    if (date.toDateString() === aujourd.toDateString()) {
      div.classList.add('aujourdhui');
    }

    if (!estPasse && aAteliersDispo) {
      div.classList.add('actif');
      div.setAttribute('role', 'button');
      div.setAttribute('tabindex', '0');
      div.setAttribute('aria-label', `Voir les ateliers du ${dateStr}`);
      div.addEventListener('click', () => ouvrirJour(dateStr));
      div.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') ouvrirJour(dateStr);
      });
      if (dateStr === dateSelectionnee) {
        div.classList.add('selectionne');
      }
    } else {
      div.classList.add('inactif');
    }

    grille.appendChild(div);
  }
}

/** Formate un objet Date en "DD/MM/YYYY" */
function formatDate(date) {
  const dd   = String(date.getDate()).padStart(2, '0');
  const mm   = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// ============================================================
//  AFFICHAGE DES ATELIERS D'UN JOUR
// ============================================================
function ouvrirJour(dateStr) {
  dateSelectionnee = dateStr;
  renderCalendrier(); // met à jour la sélection visuelle

  const liste = document.getElementById('ateliers-liste');
  liste.innerHTML = '';

  const ateliersJour = ateliersParDate[dateStr] || [];

  document.getElementById('ateliers-titre').textContent =
    `Ateliers du ${dateStr}`;

  ateliersJour.forEach(a => {
    const card = document.createElement('div');
    card.className = `atelier-card${a.placesRestantes === 0 ? ' complet' : ''}`;

    // Badge places
    let badgeClass = 'dispo';
    let badgeTexte = `${a.placesRestantes}/${a.placesMax} places`;
    if (a.placesRestantes === 0) {
      badgeClass = 'complet';
      badgeTexte = 'Complet';
    } else if (a.placesRestantes <= 2) {
      badgeClass = 'last';
      badgeTexte = `Plus que ${a.placesRestantes} place${a.placesRestantes > 1 ? 's' : ''} !`;
    }

    card.innerHTML = `
      <div class="atelier-info">
        <div class="atelier-nom">${escapeHtml(a.nom)}</div>
        <div class="atelier-horaire">🕐 ${a.debut} – ${a.fin}</div>
      </div>
      <span class="atelier-places ${badgeClass}">${badgeTexte}</span>
      <button
        class="btn-reserver"
        ${a.placesRestantes === 0 ? 'disabled' : ''}
        data-id="${a.id}"
      >${a.placesRestantes === 0 ? 'Complet' : 'Réserver'}</button>
    `;

    if (a.placesRestantes > 0) {
      card.querySelector('.btn-reserver').addEventListener('click', () => {
        ouvrirFormulaire(a);
      });
    }

    liste.appendChild(card);
  });

  afficherSection('ateliers');
}

// ============================================================
//  FORMULAIRE DE RÉSERVATION
// ============================================================
function ouvrirFormulaire(atelier) {
  atelierSelectionne = atelier;

  document.getElementById('recap-atelier').innerHTML = `
    <strong>${escapeHtml(atelier.nom)}</strong>
    📅 ${atelier.date} &nbsp;|&nbsp; 🕐 ${atelier.debut} – ${atelier.fin}
    &nbsp;|&nbsp; <span class="atelier-places dispo">${atelier.placesRestantes} place${atelier.placesRestantes > 1 ? 's' : ''} disponible${atelier.placesRestantes > 1 ? 's' : ''}</span>
  `;

  // Réinitialise le formulaire
  document.getElementById('form-reservation').reset();
  effacerErreurs();

  afficherSection('formulaire');
}

async function soumettreReservation(e) {
  e.preventDefault();

  const nom   = document.getElementById('nom').value.trim();
  const email = document.getElementById('email').value.trim();
  const tel   = document.getElementById('tel').value.trim();

  // Validation
  let valide = true;

  if (!nom) {
    afficherErreurChamp('nom', 'Veuillez saisir votre nom et prénom.');
    valide = false;
  }
  if (!email || !isEmailValide(email)) {
    afficherErreurChamp('email', 'Veuillez saisir une adresse email valide.');
    valide = false;
  }
  if (!tel) {
    afficherErreurChamp('tel', 'Veuillez saisir votre numéro de téléphone.');
    valide = false;
  }

  if (!valide) return;

  // Envoi
  setBoutonConfirmer(true);

  try {
    const payload = {
      atelierId: atelierSelectionne.id,
      nom, email, tel
    };

    const resp = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await resp.json();

    if (data.error) {
      afficherErreurGlobale(data.error);
      setBoutonConfirmer(false);
      return;
    }

    // Succès
    document.getElementById('confirmation-message').textContent =
      data.message || 'Votre réservation a bien été enregistrée.';

    // Met à jour le compteur local pour refléter immédiatement
    const a = ateliers.find(x => x.id === atelierSelectionne.id);
    if (a) a.placesRestantes = Math.max(0, a.placesRestantes - 1);
    indexerAteliersParDate();

    afficherSection('confirmation');

  } catch (err) {
    console.error('Erreur envoi réservation :', err);
    afficherErreurGlobale('Une erreur est survenue lors de l\'envoi. Veuillez réessayer.');
    setBoutonConfirmer(false);
  }
}

// ============================================================
//  NAVIGATION ENTRE SECTIONS
// ============================================================
function afficherSection(section) {
  document.querySelector('.calendrier-section').classList.add('hidden');
  document.getElementById('ateliers-section').classList.add('hidden');
  document.getElementById('formulaire-section').classList.add('hidden');
  document.getElementById('confirmation-section').classList.add('hidden');

  switch(section) {
    case 'calendrier':
      dateSelectionnee = null;
      renderCalendrier();
      document.querySelector('.calendrier-section').classList.remove('hidden');
      break;
    case 'ateliers':
      document.getElementById('ateliers-section').classList.remove('hidden');
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
  const el = document.getElementById('erreur-globale');
  document.getElementById('erreur-globale-message').textContent = msg;
  el.classList.remove('hidden');
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
  const btn    = document.getElementById('btn-confirmer');
  const texte  = document.getElementById('btn-confirmer-texte');
  const loader = document.getElementById('btn-confirmer-loader');
  btn.disabled = enCours;
  texte.classList.toggle('hidden', enCours);
  loader.classList.toggle('hidden', !enCours);
}

function isEmailValide(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Protège contre les injections XSS */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
