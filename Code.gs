// ============================================================
//  CONFIGURATION — à adapter si besoin
// ============================================================
const SHEET_ID            = '1x6_cgQwlZaY6p8wAr6_VtGjdRiuEjWpnMWvUAh-Rh1k';
const ONGLET_ATELIERS     = 'Ateliers';
const ONGLET_RESERVATIONS = 'Réservations';
const ONGLET_NEWSLETTER   = 'Inscriptions newsletter';
const SCRIPT_URL          = 'https://script.google.com/macros/s/AKfycbwXsam9kpgaGdwVbf0LYkqBpgFayk9dexy6y2CyeSvwVqvWB-SMGbrDF5Hn4m2AJKoB/exec';

// ============================================================
//  UTILITAIRES
// ============================================================

function getSpreadsheet() {
  return SHEET_ID
    ? SpreadsheetApp.openById(SHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
}

function getSheet(name) {
  return getSpreadsheet().getSheetByName(name);
}

/** Retourne toutes les lignes d'un onglet sous forme de tableau d'objets */
function sheetToObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).map((row, i) => {
    const obj = { _row: i + 2 };
    headers.forEach((h, j) => { obj[h] = row[j]; });
    return obj;
  });
}

/** Formate une date JS en "DD/MM/YYYY" */
function formatDate(d) {
  if (!d) return '';
  const date = new Date(d);
  const dd   = String(date.getDate()).padStart(2, '0');
  const mm   = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/** Convertit "DD/MM/YYYY" en "Mercredi 4 mars 2026" */
function formatDateLisible(dateStr) {
  if (!dateStr) return dateStr;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return dateStr;
  const dd   = parseInt(parts[0], 10);
  const mm   = parseInt(parts[1], 10);
  const yyyy = parseInt(parts[2], 10);
  const date = new Date(yyyy, mm - 1, dd);
  const jours = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const mois  = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
                 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  return `${jours[date.getDay()]} ${date.getDate()} ${mois[date.getMonth()]} ${yyyy}`;
}

/** Convertit "DD/MM/YYYY" + "HH:MM" en "YYYYMMDDTHHmmss" pour Google Calendar */
function dateToGcal(dateStr, timeStr) {
  if (!dateStr || !timeStr) return '';
  const dp = dateStr.split('/');
  if (dp.length !== 3) return '';
  const dd   = dp[0].padStart(2, '0');
  const mm   = dp[1].padStart(2, '0');
  const yyyy = dp[2];
  const tp   = timeStr.split(':');
  if (tp.length < 2) return '';
  const hh  = tp[0].padStart(2, '0');
  const min = tp[1].padStart(2, '0');
  return `${yyyy}${mm}${dd}T${hh}${min}00`;
}

/** Formate une valeur heure */
function formatTime(val) {
  if (!val && val !== 0) return '';
  if (val instanceof Date) return val.toTimeString().slice(0, 5);
  return String(val);
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
//  GET — Ateliers + Annulation
// ============================================================

function doGet(e) {
  try {
    const action = e && e.parameter && e.parameter.action;
    if (action === 'getAteliers') return jsonResponse(getAteliers());
    if (action === 'annuler')     return handleAnnulation(e.parameter.token);
    if (action === 'annulerJson') return handleAnnulationJson(e.parameter.token);
    if (action === 'ics')         return generateIcs(e.parameter.id);
    return jsonResponse({ status: 'ok', message: 'API de réservation opérationnelle' });
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

function getAteliers() {
  const sheetAteliers     = getSheet(ONGLET_ATELIERS);
  const sheetReservations = getSheet(ONGLET_RESERVATIONS);
  const ateliers          = sheetToObjects(sheetAteliers);
  const reservations      = sheetToObjects(sheetReservations);

  const compteur = {};
  reservations.forEach(r => {
    const id = r['ID Atelier'];
    if (id !== '' && id !== undefined) {
      const nb = Number(r['Nb personnes']) || 1;
      compteur[id] = (compteur[id] || 0) + nb;
    }
  });

  const maintenant = new Date();

  return ateliers.map((a, i) => {
    const id        = i + 1;
    const placesMax = Number(a['Nb places max']) || 0;
    const reservees = compteur[id] || 0;
    const restantes = Math.max(0, placesMax - reservees);
    const dateStr   = formatDate(a['Date']);

    // Clôture des réservations à 8h le jour de l'atelier
    let ferme = false;
    if (dateStr) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        const cutoff = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]), 8, 0, 0);
        ferme = maintenant >= cutoff;
      }
    }

    return {
      id,
      nom:             a['Nom de l\'atelier'] || '',
      date:            dateStr,
      debut:           formatTime(a['Heure début']),
      fin:             formatTime(a['Heure fin']),
      placesMax,
      placesRestantes: restantes,
      ferme
    };
  });
}

// ============================================================
//  ANNULATION — page HTML retournée au visiteur
// ============================================================

function handleAnnulation(token) {
  function page(titre, message, couleur) {
    return HtmlService.createHtmlOutput(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${titre}</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f4f7f0; display: flex;
           align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .box { background: #fff; border-radius: 12px; padding: 40px 48px;
           max-width: 480px; text-align: center; box-shadow: 0 2px 16px rgba(0,0,0,.1); }
    h2   { color: ${couleur}; margin: 0 0 16px; font-size: 22px; }
    p    { color: #555; line-height: 1.7; margin: 0 0 8px; }
    .btn { display: inline-block; margin-top: 24px; padding: 12px 28px;
           background: #1F6B2E; color: #fff; border-radius: 8px;
           text-decoration: none; font-weight: bold; }
  </style>
</head>
<body>
  <div class="box">
    <h2>${titre}</h2>
    <p>${message}</p>
    <a class="btn" href="https://sandramarino.fr/reservation/">← Retour au site</a>
  </div>
</body>
</html>`);
  }

  try {
    if (!token) return page('Lien invalide', 'Ce lien d\'annulation est invalide.', '#C0392B');

    const paddedToken = token + '==='.slice(0, (4 - token.length % 4) % 4);
    const decoded   = Utilities.newBlob(Utilities.base64DecodeWebSafe(paddedToken)).getDataAsString();
    const parts     = decoded.split('|');
    if (parts.length < 2) return page('Lien invalide', 'Ce lien est invalide ou expiré.', '#C0392B');

    const email     = parts[0];
    const atelierId = parts[1];

    const sheet        = getSheet(ONGLET_RESERVATIONS);
    const reservations = sheetToObjects(sheet);
    const found        = reservations.find(r =>
      r['Email'] && r['Email'].toString().toLowerCase().trim() === email.toLowerCase().trim() &&
      String(r['ID Atelier']) === String(atelierId)
    );

    if (!found) return page(
      'Introuvable',
      'Cette réservation est introuvable ou a déjà été annulée.',
      '#E67E22'
    );

    sheet.deleteRow(found._row);
    return page(
      '✅ Réservation annulée',
      'Votre réservation a bien été annulée.<br>Nous espérons vous accueillir une prochaine fois à l\'Écoferme !',
      '#1F6B2E'
    );

  } catch (err) {
    return page('Erreur', 'Une erreur est survenue : ' + escapeHtml(err.message), '#C0392B');
  }
}

// ============================================================
//  ANNULATION JSON — appelé depuis le frontend GitHub Pages
// ============================================================

function handleAnnulationJson(token) {
  try {
    if (!token) return jsonResponse({ status: 'error', message: 'Lien invalide.' });

    const paddedToken = token + '==='.slice(0, (4 - token.length % 4) % 4);
    const decoded     = Utilities.newBlob(Utilities.base64DecodeWebSafe(paddedToken)).getDataAsString();
    const parts       = decoded.split('|');
    if (parts.length < 2) return jsonResponse({ status: 'error', message: 'Lien invalide ou expiré.' });

    const email     = parts[0];
    const atelierId = parts[1];

    const sheet        = getSheet(ONGLET_RESERVATIONS);
    const reservations = sheetToObjects(sheet);
    const found        = reservations.find(r =>
      r['Email'] && r['Email'].toString().toLowerCase().trim() === email.toLowerCase().trim() &&
      String(r['ID Atelier']) === String(atelierId)
    );

    if (!found) return jsonResponse({ status: 'error', message: 'Cette réservation est introuvable ou a déjà été annulée.' });

    sheet.deleteRow(found._row);
    return jsonResponse({ status: 'ok', message: 'Réservation annulée.' });

  } catch (err) {
    return jsonResponse({ status: 'error', message: 'Erreur : ' + err.message });
  }
}

// ============================================================
//  ICS — Fichier calendrier téléchargeable (Apple / Outlook)
// ============================================================

function generateIcs(atelierId) {
  const ateliers = getAteliers();
  const atelier  = ateliers.find(a => a.id === Number(atelierId));
  if (!atelier) {
    return ContentService.createTextOutput('Atelier introuvable')
      .setMimeType(ContentService.MimeType.TEXT);
  }

  const dtStart = dateToGcal(atelier.date, atelier.debut);
  const dtEnd   = dateToGcal(atelier.date, atelier.fin);

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ecoferme du Var//Reservation//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    'SUMMARY:' + atelier.nom + ' \u2014 Ecoferme du Var',
    'DTSTART:' + dtStart,
    'DTEND:'   + dtEnd,
    'LOCATION:265 allee Georges Leygues\\, 83000 Toulon',
    'DESCRIPTION:Reservation confirmee a l\'Ecoferme du Var. Contact : 04 98 00 95 70',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  return ContentService.createTextOutput(icsContent)
    .setMimeType(ContentService.MimeType.TEXT);
}

// ============================================================
//  POST — Enregistre une nouvelle réservation
// ============================================================

function doPost(e) {
  try {
    if (!e || !e.postData) return jsonResponse({ error: 'Requête invalide' });

    const body = JSON.parse(e.postData.contents);
    const { atelierId, nom, email, tel, nbPersonnes, newsletter, agesEnfants } = body;

    if (!atelierId || !nom || !email || !tel) {
      return jsonResponse({ error: 'Tous les champs sont obligatoires.' });
    }

    const ateliers = getAteliers();
    const atelier  = ateliers.find(a => a.id === Number(atelierId));
    if (!atelier) return jsonResponse({ error: 'Atelier introuvable.' });

    // Vérifier clôture des réservations (8h le jour J)
    if (atelier.ferme) return jsonResponse({ clos: true, message: 'Désolé, les inscriptions pour cet atelier sont closes depuis 8h ce matin.' });

    const nbDemandes = Number(nbPersonnes) || 1;
    if (atelier.placesRestantes <= 0) return jsonResponse({ error: 'Cet atelier est complet.' });
    if (atelier.placesRestantes < nbDemandes) {
      return jsonResponse({ error: `Il ne reste que ${atelier.placesRestantes} place${atelier.placesRestantes > 1 ? 's' : ''} disponible${atelier.placesRestantes > 1 ? 's' : ''} pour cet atelier.` });
    }

    const sheetResaCheck  = getSheet(ONGLET_RESERVATIONS);
    const resasExistantes = sheetToObjects(sheetResaCheck);
    const dejaInscrit     = resasExistantes.some(r =>
      r['Email'] && r['Email'].toString().toLowerCase().trim() === email.toLowerCase().trim() &&
      String(r['ID Atelier']) === String(atelierId)
    );
    if (dejaInscrit) return jsonResponse({ error: 'Cette adresse email est déjà inscrite à cet atelier.' });

    const sheet   = getSheet(ONGLET_RESERVATIONS);
    const lastRow = sheet.getLastRow();
    const newNum  = lastRow;
    const now     = new Date();

    const headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (!headerRow.includes('Nb personnes')) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue('Nb personnes');
    }

    sheet.appendRow([
      newNum, atelier.nom, atelier.date, atelier.debut, atelier.fin,
      nom, email, tel, atelierId,
      Utilities.formatDate(now, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm'),
      nbDemandes
    ]);

    appliquerZebrage(sheet, sheet.getLastRow());
    envoyerEmailConfirmation(email, nom, atelier, nbPersonnes, agesEnfants);

    let dejaInscritNewsletter = false;
    if (newsletter === true) {
      dejaInscritNewsletter = enregistrerNewsletter(email, nom, atelier.nom);
    }

    return jsonResponse({
      success: true,
      message: `Votre place pour "${atelier.nom}" le ${atelier.date} de ${atelier.debut} à ${atelier.fin} est confirmée !`,
      dejaInscritNewsletter
    });

  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

// ============================================================
//  INITIALISATION
// ============================================================

function enregistrerNewsletter(email, nom, atelierNom) {
  const ss    = getSpreadsheet();
  let sheet   = ss.getSheetByName(ONGLET_NEWSLETTER);
  if (!sheet) sheet = creerOngletNewsletter(ss);

  // Anti-doublon : ne pas inscrire deux fois le même email
  const existants = sheetToObjects(sheet);
  const dejaInscrit = existants.some(r =>
    r['Email'] && r['Email'].toString().toLowerCase().trim() === email.toLowerCase().trim()
  );
  if (dejaInscrit) return true; // déjà inscrit

  const now = new Date();
  sheet.appendRow([
    Utilities.formatDate(now, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm'),
    nom, email, atelierNom
  ]);
  appliquerZebrage(sheet, sheet.getLastRow());
  return false; // nouvel inscrit
}

function creerOngletNewsletter(ss) {
  let sheet = ss.getSheetByName(ONGLET_NEWSLETTER);
  if (!sheet) sheet = ss.insertSheet(ONGLET_NEWSLETTER);
  sheet.clearFormats();
  sheet.clearContents();

  const headers = ['Date inscription', 'Prénom / Nom', 'Email', 'Via atelier'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#1F6B2E').setFontColor('#FFFFFF')
    .setFontWeight('bold').setHorizontalAlignment('center');
  sheet.setFrozenRows(1);
  [140, 180, 220, 200].forEach((w, i) => sheet.setColumnWidth(i + 1, w));
  return sheet;
}

function initialiserSheet() {
  const ss = getSpreadsheet();
  creerOngletAteliers(ss);
  creerOngletReservations(ss);
  creerOngletNewsletter(ss);
  SpreadsheetApp.getUi().alert('✅ Initialisation terminée ! Les trois onglets sont prêts.');
}

function creerOngletAteliers(ss) {
  let sheet = ss.getSheetByName(ONGLET_ATELIERS);
  if (!sheet) sheet = ss.insertSheet(ONGLET_ATELIERS);
  sheet.clearFormats();
  sheet.clearContents();

  const headers = ['Nom de l\'atelier', 'Email médiateur', 'Date', 'Heure début', 'Heure fin', 'Nb places max'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#4A6FA5').setFontColor('#FFFFFF')
    .setFontWeight('bold').setHorizontalAlignment('center');
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 200); sheet.setColumnWidth(2, 210);
  sheet.setColumnWidth(3, 120); sheet.setColumnWidth(4, 110);
  sheet.setColumnWidth(5, 110); sheet.setColumnWidth(6, 130);

  const exemples = [
    ['Poterie',   'mediateur@exemple.com', new Date(), '10:00', '12:30', 8],
    ['Aquarelle', '',                       new Date(), '14:00', '16:00', 6],
  ];
  sheet.getRange(2, 1, exemples.length, headers.length).setValues(exemples);
  sheet.getRange(2, 3, sheet.getMaxRows() - 1, 1).setNumberFormat('DD/MM/YYYY');
  sheet.getRange(1, 1, sheet.getLastRow(), headers.length)
    .setBorder(true, true, true, true, true, true);
}

function creerOngletReservations(ss) {
  let sheet = ss.getSheetByName(ONGLET_RESERVATIONS);
  if (!sheet) sheet = ss.insertSheet(ONGLET_RESERVATIONS);
  sheet.clearFormats();
  sheet.clearContents();

  const headers = ['#', 'Atelier', 'Date', 'Heure début', 'Heure fin',
                   'Nom / Prénom', 'Email', 'Téléphone', 'ID Atelier', 'Soumis le'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#2E7D32').setFontColor('#FFFFFF')
    .setFontWeight('bold').setHorizontalAlignment('center');
  sheet.setFrozenRows(1);
  [40, 180, 110, 110, 110, 180, 200, 130, 100, 140].forEach((w, i) => sheet.setColumnWidth(i + 1, w));
  try { sheet.setHiddenGridlines(false); } catch(e) {}
}

function appliquerZebrage(sheet, rowIndex) {
  const nbCols  = 11;
  const range   = sheet.getRange(rowIndex, 1, 1, nbCols);
  const couleur = rowIndex % 2 === 0 ? '#F1F8E9' : '#FFFFFF';
  range.setBackground(couleur);
  range.setBorder(true, true, true, true, true, true);
}

// ============================================================
//  EMAIL DE CONFIRMATION
// ============================================================

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function envoyerEmailConfirmation(email, nom, atelier, nbPersonnes, agesEnfants) {
  try {
    const dateLisible = formatDateLisible(atelier.date);
    const sujet       = `✅ Confirmation — ${atelier.nom} le ${dateLisible}`;

    // --- Token annulation — lien vers GitHub Pages (évite le problème Drive de Gmail) ---
    const token     = Utilities.base64EncodeWebSafe(email + '|' + atelier.id).replace(/=+$/, '');
    const cancelUrl = 'https://sandramarino.fr/reservation/?action=annuler&token=' + token;

    // --- URL Google Calendar ---
    const gcalStart = dateToGcal(atelier.date, atelier.debut);
    const gcalEnd   = dateToGcal(atelier.date, atelier.fin);
    const calendarUrl = 'https://calendar.google.com/calendar/render?action=TEMPLATE'
      + '&text='     + encodeURIComponent(atelier.nom + ' — Écoferme du Var')
      + '&dates='    + gcalStart + '/' + gcalEnd
      + '&details='  + encodeURIComponent('Réservation confirmée à l\'Écoferme du Var')
      + '&location=' + encodeURIComponent('265 allée Georges Leygues 83000 Toulon');

    // --- URL ICS (Apple Calendar / Outlook) ---
    const icsUrl = SCRIPT_URL + '?action=ics&id=' + atelier.id;

    // --- Données pour l'icône Apple Calendar (affiche la vraie date de l'atelier) ---
    const [jourStr, moisStrN] = atelier.date.split('/');
    const jourNum  = parseInt(jourStr, 10);
    const _moisCourts = ['JAN','FÉV','MAR','AVR','MAI','JUN','JUL','AOÛ','SEP','OCT','NOV','DÉC'];
    const moisCourt = _moisCourts[parseInt(moisStrN, 10) - 1] || '';

    // --- Labels âge ---
    const labelsAge = {
      'moins-3ans': 'Moins de 3 ans',
      '3-10ans':    '3 à 10 ans',
      'plus-10ans': 'Plus de 10 ans'
    };

    // --- Photo de l'atelier (URL absolue publique) ---
    // ⚠️ Remplacer les URL picsum par les vraies photos quand disponibles
    const PHOTOS_ATELIERS = {
      'Rencontre avec les animaux':      'https://sandramarino.fr/reservation/images/animaux/Fine1.jpg',
      "Mémoires de l'écoferme":          'https://picsum.photos/seed/ferme77/700/400',
      "Visite découverte de l'Écoferme": 'https://picsum.photos/seed/ecoferme33/700/400'
    };
    const photoUrl   = PHOTOS_ATELIERS[atelier.nom] || '';
    const photoBlock = photoUrl
      ? `<tr>
           <td style="padding:0;line-height:0;">
             <img src="${photoUrl}" alt="${escapeHtml(atelier.nom)}" width="600"
               style="display:block;width:100%;max-height:220px;object-fit:cover;">
           </td>
         </tr>`
      : '';

    // --- Ligne participants (intégrée dans le récapitulatif) ---
    let participantsLigne = '';
    if (agesEnfants && agesEnfants.length > 0) {
      const nbEnfants  = agesEnfants.length;
      const lignesAges = agesEnfants
        .map((a, i) => `Enfant ${i + 1}&nbsp;&mdash;&nbsp;${labelsAge[a] || a}`)
        .join('<br>');
      participantsLigne = `
              <p style="margin:0 0 5px;font-size:15px;color:#555;">👥 &nbsp;1 adulte et ${nbEnfants} enfant${nbEnfants > 1 ? 's' : ''}</p>
              <p style="margin:0 0 5px;font-size:13px;color:#777;padding-left:24px;">${lignesAges}</p>`;
    } else if (nbPersonnes && nbPersonnes > 0) {
      participantsLigne = `
              <p style="margin:0 0 5px;font-size:15px;color:#555;">👥 &nbsp;${nbPersonnes} personne${nbPersonnes > 1 ? 's' : ''}</p>`;
    }

    // -------------------------------------------------------
    //  CORPS DE L'EMAIL  (ordre des blocs : A B C E D F G)
    //  A = En-tête + photo   B = Accueil   C = Récap complet
    //  E = Annulation        D = Agenda    F = Courtoisie
    //  G = Footer
    // -------------------------------------------------------
    const corps = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f7f0;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7f0;padding:30px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">

        <!-- BLOC A — En-tête visuel : logo + titre -->
        <tr>
          <td style="background:#1F6B2E;padding:24px 40px;text-align:center;">
            <img src="https://sandramarino.fr/reservation/logo-ecoferme.png" alt="Écoferme départementale de la Barre" height="60" style="display:block;margin:0 auto 12px auto;">
            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:normal;">🎉 Réservation confirmée</h1>
          </td>
        </tr>

        <!-- BLOC A (suite) — Photo de l'atelier réservé -->
        ${photoBlock}

        <!-- BLOCS B·C·E·D·F — Corps principal -->
        <tr>
          <td style="padding:35px 40px;">

            <!-- BLOC B — Message d'accueil -->
            <p style="margin:0 0 6px;font-size:16px;color:#333;">Bonjour <strong>${escapeHtml(nom)}</strong>,</p>
            <p style="margin:0 0 6px;font-size:16px;color:#333;line-height:1.6;">Votre réservation est bien confirmée.</p>
            <p style="margin:0 0 24px;font-size:16px;color:#333;line-height:1.6;">Nous avons hâte de vous accueillir à l'Écoferme départementale de la Barre&nbsp;!</p>

            <!-- BLOC C — Récapitulatif complet -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#E8F5EB;border-left:4px solid #1F6B2E;border-radius:4px;margin-bottom:20px;">
              <tr>
                <td style="padding:20px 25px;">
                  <p style="margin:0 0 10px;font-size:18px;color:#1F6B2E;font-weight:bold;">${escapeHtml(atelier.nom)}</p>
                  <p style="margin:0 0 5px;font-size:16px;color:#555;">📅 &nbsp;${dateLisible}</p>
                  <p style="margin:0 0 5px;font-size:16px;color:#555;">🕐 &nbsp;${atelier.debut} – ${atelier.fin}</p>
                  <p style="margin:0 0 5px;font-size:16px;color:#555;">👤 &nbsp;${escapeHtml(nom)}</p>
                  ${participantsLigne}
                  <p style="margin:0;font-size:16px;color:#555;">📍 &nbsp;<a href="https://maps.google.com/?q=265+allée+Georges+Leygues+83000+Toulon" style="color:#1F6B2E;text-decoration:underline;">Écoferme, 55, allée Georges Leygues, 83000 Toulon</a></p>
                </td>
              </tr>
            </table>

            <!-- BLOC E — Empêchement + annulation (juste après l'encart) -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff8f0;border:1px solid #f0dcc8;border-radius:8px;margin-bottom:28px;">
              <tr>
                <td style="padding:18px 24px;text-align:center;">
                  <p style="margin:0 0 14px;font-size:15px;color:#555;line-height:1.6;">
                    En cas d'empêchement, afin que chacun puisse bénéficier de cette belle expérience, merci de bien vouloir nous en informer.
                  </p>
                  <a href="${cancelUrl}" style="display:inline-block;padding:10px 22px;background:#f5f5f5;border:1.5px solid #bbb;color:#444;border-radius:6px;text-decoration:none;font-size:15px;font-weight:bold;">✖ Annuler ma réservation</a>
                </td>
              </tr>
            </table>

            <!-- BLOC D — Ajouter à mon agenda (icônes app-style SVG) -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
              <tr>
                <td align="center">
                  <p style="margin:0 0 18px;font-size:15px;color:#333;font-weight:bold;text-transform:uppercase;letter-spacing:0.8px;">Ajouter à mon agenda</p>
                  <table cellpadding="0" cellspacing="0">
                    <tr valign="top">

                      <!-- 1. Google Agenda -->
                      <td style="padding:0 14px;text-align:center;">
                        <a href="${calendarUrl}" target="_blank" style="display:inline-block;text-decoration:none;">
                          <svg width="70" height="70" viewBox="0 0 70 70" xmlns="http://www.w3.org/2000/svg">
                            <rect width="70" height="70" rx="15" fill="white"/>
                            <rect x="2" y="2" width="32" height="32" fill="#4285F4"/>
                            <rect x="36" y="2" width="32" height="32" fill="#EA4335"/>
                            <rect x="2" y="36" width="32" height="32" fill="#34A853"/>
                            <rect x="36" y="36" width="32" height="32" fill="#FBBC04"/>
                            <path d="M 0 0 L 15 0 Q 0 0 0 15 Z" fill="white"/>
                            <path d="M 70 0 L 55 0 Q 70 0 70 15 Z" fill="white"/>
                            <path d="M 0 70 L 0 55 Q 0 70 15 70 Z" fill="white"/>
                            <path d="M 70 70 L 70 55 Q 70 70 55 70 Z" fill="white"/>
                            <rect x="16" y="16" width="38" height="38" fill="white"/>
                            <text x="35" y="40" text-anchor="middle" fill="#4285F4" font-family="Arial,sans-serif" font-weight="bold" font-size="18">${jourNum}</text>
                            <rect width="70" height="70" rx="15" fill="none" stroke="#dadce0" stroke-width="1.5"/>
                            <circle cx="57" cy="57" r="11" fill="white" stroke="#dadce0" stroke-width="1.5"/>
                            <text x="57" y="62" text-anchor="middle" fill="#34A853" font-family="Arial,sans-serif" font-weight="bold" font-size="17">+</text>
                          </svg>
                          <table cellpadding="0" cellspacing="0" width="80"><tr><td align="center" style="font-size:10px;font-weight:bold;color:#444;font-family:Arial,sans-serif;padding-top:7px;line-height:1.5;text-transform:uppercase;">Ajouter à<br/>Google Agenda</td></tr></table>
                        </a>
                      </td>

                      <!-- 2. Microsoft Outlook -->
                      <td style="padding:0 14px;text-align:center;">
                        <a href="${icsUrl}" style="display:inline-block;text-decoration:none;">
                          <svg width="70" height="70" viewBox="0 0 70 70" xmlns="http://www.w3.org/2000/svg">
                            <rect width="70" height="70" rx="15" fill="#0078D4"/>
                            <rect x="11" y="14" width="48" height="42" rx="5" fill="none" stroke="white" stroke-width="2.5"/>
                            <line x1="11" y1="26" x2="59" y2="26" stroke="white" stroke-width="2.5"/>
                            <rect x="23" y="9" width="5" height="11" rx="2.5" fill="white"/>
                            <rect x="42" y="9" width="5" height="11" rx="2.5" fill="white"/>
                            <rect x="17" y="32" width="8" height="8" rx="2" fill="white"/>
                            <rect x="31" y="32" width="8" height="8" rx="2" fill="white"/>
                            <rect x="45" y="32" width="8" height="8" rx="2" fill="white"/>
                            <rect x="17" y="44" width="8" height="8" rx="2" fill="white"/>
                            <rect x="31" y="44" width="8" height="8" rx="2" fill="white"/>
                            <circle cx="57" cy="57" r="11" fill="white"/>
                            <text x="57" y="62" text-anchor="middle" fill="#0078D4" font-family="Arial,sans-serif" font-weight="bold" font-size="17">+</text>
                          </svg>
                          <table cellpadding="0" cellspacing="0" width="80"><tr><td align="center" style="font-size:10px;font-weight:bold;color:#444;font-family:Arial,sans-serif;padding-top:7px;line-height:1.5;text-transform:uppercase;">Ajouter à<br/>Microsoft Outlook</td></tr></table>
                        </a>
                      </td>

                      <!-- 3. Apple Calendar -->
                      <td style="padding:0 14px;text-align:center;">
                        <a href="${icsUrl}" style="display:inline-block;text-decoration:none;">
                          <svg width="70" height="70" viewBox="0 0 70 70" xmlns="http://www.w3.org/2000/svg">
                            <rect width="70" height="70" rx="15" fill="white"/>
                            <rect x="2" y="2" width="66" height="24" rx="13" fill="#FF3B30"/>
                            <rect x="2" y="14" width="66" height="13" fill="#FF3B30"/>
                            <text x="35" y="21" text-anchor="middle" fill="white" font-family="Arial,sans-serif" font-weight="bold" font-size="11" letter-spacing="2">${moisCourt}</text>
                            <text x="35" y="58" text-anchor="middle" fill="#1a1a1a" font-family="Arial,sans-serif" font-weight="bold" font-size="30">${jourNum}</text>
                            <rect width="70" height="70" rx="15" fill="none" stroke="#dadce0" stroke-width="1.5"/>
                            <circle cx="57" cy="57" r="11" fill="white" stroke="#dadce0" stroke-width="1.5"/>
                            <text x="57" y="62" text-anchor="middle" fill="#FF3B30" font-family="Arial,sans-serif" font-weight="bold" font-size="17">+</text>
                          </svg>
                          <table cellpadding="0" cellspacing="0" width="80"><tr><td align="center" style="font-size:10px;font-weight:bold;color:#444;font-family:Arial,sans-serif;padding-top:7px;line-height:1.5;text-transform:uppercase;">Ajouter à<br/>l'Agenda Apple</td></tr></table>
                        </a>
                      </td>

                    </tr>
                  </table>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- BLOC G — Footer -->
        <tr>
          <td style="background:#E8F5EB;padding:25px 40px;text-align:center;">

            <!-- Coordonnées -->
            <p style="margin:0 0 4px;font-size:14px;color:#333;">
              <a href="tel:+33498009570" style="color:#1F6B2E;font-weight:bold;text-decoration:none;">📞 04 98 00 95 70</a>
              &nbsp;|&nbsp;
              <a href="mailto:ecoferme@var.fr" style="color:#1F6B2E;text-decoration:none;">✉ ecoferme@var.fr</a>
            </p>
            <p style="margin:0 0 20px;font-size:14px;color:#333;">
              <a href="https://maps.google.com/?q=265+allée+Georges+Leygues+83000+Toulon" style="color:#1F6B2E;text-decoration:underline;">📍 Écoferme, 55, allée Georges Leygues, 83000 Toulon</a>
            </p>

            <!-- Facebook -->
            <p style="margin:0 0 20px;">
              <a href="https://www.facebook.com/ecofermedepartementaledelabarre/" style="display:inline-flex;align-items:center;gap:8px;color:#3b5998;text-decoration:none;font-size:14px;">
                <span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;background:#3b5998;border-radius:4px;color:#ffffff;font-weight:bold;font-size:13px;line-height:1;">f</span>
                Suivez notre actualité sur Facebook
              </a>
            </p>

            <!-- Logo Département du Var -->
            <p style="margin:0 0 20px;">
              <img src="https://sandramarino.fr/reservation/logo-departement.png" alt="Département du Var" height="55" style="display:inline-block;">
            </p>

            <hr style="border:none;border-top:1px solid #c8dfc9;margin:0 0 12px;">
            <p style="margin:0;font-size:12px;color:#999;">Cet email a été envoyé automatiquement suite à votre réservation.</p>

          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    MailApp.sendEmail({ to: email, subject: sujet, htmlBody: corps });

  } catch (err) {
    console.error('Erreur envoi email :', err.message);
  }
}

// ============================================================
//  ORGANISATION DES RÉSERVATIONS
// ============================================================

/**
 * Trie l'onglet Réservations par : 1. Nom atelier → 2. Date → 3. Heure début
 * Insère une ligne vide entre chaque groupe (même atelier + même date).
 * À lancer depuis le menu "🎨 Ateliers" dans Google Sheets.
 */
function organiserReservations() {
  const sheet   = getSheet(ONGLET_RESERVATIONS);
  const allData = sheet.getDataRange().getValues();
  if (allData.length < 2) {
    SpreadsheetApp.getUi().alert('Aucune réservation à organiser.');
    return;
  }

  const headers = allData[0];
  const nbCols  = headers.length;

  // Filtrer les lignes vides (séparateurs existants)
  let rows = allData.slice(1).filter(row =>
    row[1] !== '' && row[1] !== undefined && row[1] !== null
  );

  if (rows.length === 0) {
    SpreadsheetApp.getUi().alert('Aucune réservation à organiser.');
    return;
  }

  // Tri : Date (col C=2) → Heure début (col D=3) → Nom atelier (col B=1)
  rows.sort((a, b) => {
    const dateA = _dateTriable(a[2]);
    const dateB = _dateTriable(b[2]);
    if (dateA !== dateB) return dateA < dateB ? -1 : 1;

    const heureA = String(a[3] || '');
    const heureB = String(b[3] || '');
    if (heureA !== heureB) return heureA < heureB ? -1 : 1;

    const nomA = String(a[1] || '').toLowerCase().trim();
    const nomB = String(b[1] || '').toLowerCase().trim();
    return nomA < nomB ? -1 : nomA > nomB ? 1 : 0;
  });

  // Effacer toutes les lignes de données (conserver l'en-tête)
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clear();
  }

  // Normaliser les colonnes date/heure (convertir objets Date en chaînes)
  rows = rows.map(row => {
    const r = row.slice();
    if (r[2] instanceof Date) r[2] = formatDate(r[2]);
    if (r[3] instanceof Date) r[3] = formatTime(r[3]);
    if (r[4] instanceof Date) r[4] = formatTime(r[4]);
    return r;
  });

  // Réécrire avec ligne séparatrice entre chaque groupe (date + heure début + atelier)
  let writeRow   = 2;
  let lastGroupe = null;
  let zebraIdx   = 0;

  rows.forEach(row => {
    const groupe = _dateTriable(row[2]) + '|' + String(row[3] || '') + '|' + String(row[1] || '').trim();

    if (lastGroupe !== null && groupe !== lastGroupe) {
      writeRow++; // ligne vide séparatrice
    }
    lastGroupe = groupe;

    sheet.getRange(writeRow, 1, 1, nbCols).setValues([row]);
    const couleur = zebraIdx % 2 === 0 ? '#FFFFFF' : '#F1F8E9';
    sheet.getRange(writeRow, 1, 1, Math.min(nbCols, 11))
      .setBackground(couleur)
      .setBorder(true, true, true, true, true, true);

    writeRow++;
    zebraIdx++;
  });

  SpreadsheetApp.getUi().alert(
    '✅ ' + rows.length + ' réservation(s) organisées par atelier et date.'
  );
}

/**
 * Convertit une date (objet Date ou chaîne "DD/MM/YYYY") en "YYYYMMDD" pour le tri.
 */
function _dateTriable(val) {
  if (!val) return '';
  if (val instanceof Date) {
    return val.getFullYear()
      + String(val.getMonth() + 1).padStart(2, '0')
      + String(val.getDate()).padStart(2, '0');
  }
  const parts = String(val).split('/');
  if (parts.length === 3) return parts[2] + parts[1] + parts[0];
  return String(val);
}

// ============================================================
//  MENU PERSONNALISÉ dans Google Sheets
// ============================================================

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Ateliers')
    .addItem('Initialiser les onglets',              'initialiserSheet')
    .addItem('Organiser les réservations',           'organiserReservations')
    .addItem('Reparer les en-têtes',                 'reparerEnTetes')
    .addSeparator()
    .addItem('📋 Envoyer récap médiateurs (test)',   'envoyerRecapMediateurs')
    .addItem('⏰ Activer envoi automatique 8h15',    'creerDeclencheur')
    .addToUi();
}

// ============================================================
//  MÉDIATEURS — Récap quotidien envoyé à 8h15 le jour J
// ============================================================

/**
 * Envoie à chaque médiateur la liste des inscrits à ses ateliers du jour.
 * Déclenché automatiquement à 8h15 par creerDeclencheur().
 * Peut aussi être lancé manuellement depuis le menu Ateliers > 📋 Envoyer récap.
 */
function envoyerRecapMediateurs() {
  const today    = new Date();
  const todayStr = formatDate(today);

  const sheetAteliers = getSheet(ONGLET_ATELIERS);
  const sheetResa     = getSheet(ONGLET_RESERVATIONS);
  if (!sheetAteliers || !sheetResa) return;

  const ateliers     = sheetToObjects(sheetAteliers);
  const reservations = sheetToObjects(sheetResa);

  // Ateliers dont la date correspond à aujourd'hui
  const ateliersAujourdhui = ateliers.filter(a => formatDate(a['Date']) === todayStr);
  if (ateliersAujourdhui.length === 0) return;

  ateliersAujourdhui.forEach(atelier => {
    const emailMediateur = (atelier['Email médiateur'] || '').trim();
    if (!emailMediateur) return; // Pas de médiateur configuré → on passe

    const atelierId  = atelier._row - 1; // ID = numéro de ligne sans en-tête
    const nomAtelier = atelier['Nom de l\'atelier'] || '';
    const heureDeb   = formatTime(atelier['Heure début']);
    const heureFin   = formatTime(atelier['Heure fin']);
    const dateLisible = formatDateLisible(todayStr);

    // Inscrits pour cet atelier
    const inscrits = reservations.filter(r => String(r['ID Atelier']) === String(atelierId));
    const totalPersonnes = inscrits.reduce((sum, r) => sum + (Number(r['Nb personnes']) || 1), 0);

    // Construction du tableau HTML des inscrits
    let lignesTableau = '';
    if (inscrits.length === 0) {
      lignesTableau = `<tr><td colspan="4" style="padding:16px;text-align:center;font-family:Arial,sans-serif;font-size:14px;color:#888;font-style:italic;">Aucun inscrit pour cet atelier.</td></tr>`;
    } else {
      inscrits.forEach((r, idx) => {
        const nb       = Number(r['Nb personnes']) || 1;
        const couleur  = idx % 2 === 0 ? '#ffffff' : '#f0f8f1';
        lignesTableau += `
        <tr style="background:${couleur};">
          <td style="padding:10px 14px;font-family:Arial,sans-serif;font-size:14px;color:#555;border-bottom:1px solid #e8e8e8;">${idx + 1}</td>
          <td style="padding:10px 14px;font-family:Arial,sans-serif;font-size:14px;color:#222;font-weight:bold;border-bottom:1px solid #e8e8e8;">${escapeHtml(r['Nom / Prénom'] || '')}</td>
          <td style="padding:10px 14px;font-family:Arial,sans-serif;font-size:14px;color:#333;border-bottom:1px solid #e8e8e8;">${escapeHtml(String(r['Téléphone'] || ''))}</td>
          <td style="padding:10px 14px;font-family:Arial,sans-serif;font-size:14px;color:#333;text-align:center;border-bottom:1px solid #e8e8e8;font-weight:bold;">${nb}</td>
        </tr>`;
      });
    }

    const htmlEmail = `
<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:30px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

      <!-- En-tête vert -->
      <tr>
        <td style="background:#1F6B2E;padding:24px 32px;text-align:center;">
          <p style="margin:0;font-size:11px;font-weight:bold;color:#a5d6a7;text-transform:uppercase;letter-spacing:1.5px;">Liste des participants</p>
          <h1 style="margin:8px 0 0;font-size:22px;color:#ffffff;">${escapeHtml(nomAtelier)}</h1>
        </td>
      </tr>

      <!-- Date + heure -->
      <tr>
        <td style="background:#E8F5EB;padding:16px 32px;text-align:center;border-bottom:2px solid #1F6B2E;">
          <p style="margin:0;font-size:15px;color:#1F6B2E;font-weight:bold;">📅 ${dateLisible} &nbsp;·&nbsp; ${heureDeb} – ${heureFin}</p>
          <p style="margin:6px 0 0;font-size:13px;color:#555;">${inscrits.length} réservation${inscrits.length > 1 ? 's' : ''} · <strong>${totalPersonnes} personne${totalPersonnes > 1 ? 's' : ''}</strong></p>
        </td>
      </tr>

      <!-- Tableau inscrits -->
      <tr>
        <td style="padding:24px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:8px;overflow:hidden;border:1px solid #e0e0e0;">
            <!-- En-tête tableau -->
            <tr style="background:#1F6B2E;">
              <td style="padding:10px 14px;font-family:Arial,sans-serif;font-size:12px;font-weight:bold;color:#ffffff;text-transform:uppercase;letter-spacing:0.5px;width:40px;">#</td>
              <td style="padding:10px 14px;font-family:Arial,sans-serif;font-size:12px;font-weight:bold;color:#ffffff;text-transform:uppercase;letter-spacing:0.5px;">Nom / Prénom</td>
              <td style="padding:10px 14px;font-family:Arial,sans-serif;font-size:12px;font-weight:bold;color:#ffffff;text-transform:uppercase;letter-spacing:0.5px;">Téléphone</td>
              <td style="padding:10px 14px;font-family:Arial,sans-serif;font-size:12px;font-weight:bold;color:#ffffff;text-transform:uppercase;letter-spacing:0.5px;text-align:center;width:80px;">Nb pers.</td>
            </tr>
            ${lignesTableau}
          </table>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background:#f9f9f9;padding:18px 32px;text-align:center;border-top:1px solid #eee;">
          <p style="margin:0;font-size:12px;color:#aaa;">Écoferme Départementale de la Barre · 55 allée Georges Leygues, Toulon · <a href="tel:+33498009570" style="color:#1F6B2E;">04 98 00 95 70</a></p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body></html>`;

    MailApp.sendEmail({
      to:       emailMediateur,
      subject:  `📋 ${inscrits.length} inscrit${inscrits.length > 1 ? 's' : ''} — ${nomAtelier} ${heureDeb} | ${dateLisible}`,
      htmlBody: htmlEmail
    });
  });
}

/**
 * Crée le déclencheur automatique quotidien à 8h (→ 8h15 env.).
 * À lancer UNE SEULE FOIS depuis le menu Ateliers > ⏰ Activer envoi automatique.
 */
function creerDeclencheur() {
  // Supprimer les anciens déclencheurs pour éviter les doublons
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'envoyerRecapMediateurs') {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger('envoyerRecapMediateurs')
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .create();

  SpreadsheetApp.getUi().alert(
    '✅ Déclencheur activé !\n\n' +
    'Chaque matin à 8h15 environ, les médiateurs recevront automatiquement\n' +
    'la liste des inscrits à leurs ateliers du jour.\n\n' +
    'Tu peux tester maintenant via : 📋 Envoyer récap médiateurs (test)'
  );
}

/**
 * Corrige les en-têtes corrompus sans effacer les données existantes.
 */
function reparerEnTetes() {
  const ss = getSpreadsheet();

  // Onglet Ateliers
  const ateliers = ss.getSheetByName(ONGLET_ATELIERS);
  if (ateliers) {
    const headers = ['Nom de l\'atelier', 'Email médiateur', 'Date', 'Heure début', 'Heure fin', 'Nb places max'];
    ateliers.getRange(1, 1, 1, headers.length).setValues([headers]);
    ateliers.getRange(1, 1, 1, headers.length)
      .setBackground('#4A6FA5').setFontColor('#FFFFFF')
      .setFontWeight('bold').setHorizontalAlignment('center');
  }

  // Onglet Newsletter
  const newsletter = ss.getSheetByName(ONGLET_NEWSLETTER);
  if (newsletter) {
    const headers = ['Date inscription', 'Prénom / Nom', 'Email', 'Via atelier'];
    newsletter.getRange(1, 1, 1, headers.length).setValues([headers]);
    newsletter.getRange(1, 1, 1, headers.length)
      .setBackground('#1F6B2E').setFontColor('#FFFFFF')
      .setFontWeight('bold').setHorizontalAlignment('center');
  }

  // Onglet Réservations
  const reservations = ss.getSheetByName(ONGLET_RESERVATIONS);
  if (reservations) {
    const headers = ['#', 'Atelier', 'Date', 'Heure début', 'Heure fin',
                     'Nom / Prénom', 'Email', 'Téléphone', 'ID Atelier', 'Soumis le', 'Nb personnes'];
    reservations.getRange(1, 1, 1, headers.length).setValues([headers]);
    reservations.getRange(1, 1, 1, headers.length)
      .setBackground('#1F6B2E').setFontColor('#FFFFFF')
      .setFontWeight('bold').setHorizontalAlignment('center');
  }

  SpreadsheetApp.getUi().alert('En-têtes corrigés !');
}
