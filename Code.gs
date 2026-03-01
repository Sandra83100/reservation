// ============================================================
//  CONFIGURATION — à adapter si besoin
// ============================================================
const SHEET_ID            = '1x6_cgQwlZaY6p8wAr6_VtGjdRiuEjWpnMWvUAh-Rh1k';
const ONGLET_ATELIERS     = 'Ateliers';
const ONGLET_RESERVATIONS = 'Réservations';
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

  return ateliers.map((a, i) => {
    const id        = i + 1;
    const placesMax = Number(a['Nb places max']) || 0;
    const reservees = compteur[id] || 0;
    const restantes = Math.max(0, placesMax - reservees);
    return {
      id,
      nom:             a['Nom de l\'atelier'] || '',
      date:            formatDate(a['Date']),
      debut:           formatTime(a['Heure début']),
      fin:             formatTime(a['Heure fin']),
      placesMax,
      placesRestantes: restantes
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
    <a class="btn" href="https://sandra83100.github.io/reservation/">← Retour au site</a>
  </div>
</body>
</html>`);
  }

  try {
    if (!token) return page('Lien invalide', 'Ce lien d\'annulation est invalide.', '#C0392B');

    const decoded   = Utilities.newBlob(Utilities.base64DecodeWebSafe(token)).getDataAsString();
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
//  POST — Enregistre une nouvelle réservation
// ============================================================

function doPost(e) {
  try {
    if (!e || !e.postData) return jsonResponse({ error: 'Requête invalide' });

    const body = JSON.parse(e.postData.contents);
    const { atelierId, nom, email, tel, nbPersonnes, agesEnfants } = body;

    if (!atelierId || !nom || !email || !tel) {
      return jsonResponse({ error: 'Tous les champs sont obligatoires.' });
    }

    const ateliers = getAteliers();
    const atelier  = ateliers.find(a => a.id === Number(atelierId));
    if (!atelier) return jsonResponse({ error: 'Atelier introuvable.' });

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

    return jsonResponse({
      success: true,
      message: `Votre place pour "${atelier.nom}" le ${atelier.date} de ${atelier.debut} à ${atelier.fin} est confirmée !`
    });

  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

// ============================================================
//  INITIALISATION
// ============================================================

function initialiserSheet() {
  const ss = getSpreadsheet();
  creerOngletAteliers(ss);
  creerOngletReservations(ss);
  SpreadsheetApp.getUi().alert('✅ Initialisation terminée ! Les deux onglets sont prêts.');
}

function creerOngletAteliers(ss) {
  let sheet = ss.getSheetByName(ONGLET_ATELIERS);
  if (!sheet) sheet = ss.insertSheet(ONGLET_ATELIERS);
  sheet.clearFormats();
  sheet.clearContents();

  const headers = ['Nom de l\'atelier', 'Date', 'Heure début', 'Heure fin', 'Nb places max'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#4A6FA5').setFontColor('#FFFFFF')
    .setFontWeight('bold').setHorizontalAlignment('center');
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 200); sheet.setColumnWidth(2, 120);
  sheet.setColumnWidth(3, 110); sheet.setColumnWidth(4, 110); sheet.setColumnWidth(5, 130);

  const exemples = [
    ['Poterie',   new Date(), '10:00', '12:30', 8],
    ['Aquarelle', new Date(), '14:00', '16:00', 6],
  ];
  sheet.getRange(2, 1, exemples.length, headers.length).setValues(exemples);
  sheet.getRange(2, 2, sheet.getMaxRows() - 1, 1).setNumberFormat('DD/MM/YYYY');
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

    // --- Token annulation ---
    const token     = Utilities.base64EncodeWebSafe(email + '|' + atelier.id);
    const cancelUrl = SCRIPT_URL + '?action=annuler&token=' + token;

    // --- URL Google Calendar ---
    const gcalStart = dateToGcal(atelier.date, atelier.debut);
    const gcalEnd   = dateToGcal(atelier.date, atelier.fin);
    const calendarUrl = 'https://calendar.google.com/calendar/render?action=TEMPLATE'
      + '&text='     + encodeURIComponent(atelier.nom + ' — Écoferme du Var')
      + '&dates='    + gcalStart + '/' + gcalEnd
      + '&details='  + encodeURIComponent('Réservation confirmée à l\'Écoferme du Var')
      + '&location=' + encodeURIComponent('55 allée Georges Legg, 83000 Toulon');

    // --- Labels âge ---
    const labelsAge = {
      'moins-3ans': 'Moins de 3 ans',
      '3-10ans':    '3 à 10 ans',
      'plus-10ans': 'Plus de 10 ans'
    };

    // --- Bloc participants ---
    const NOM_ANIMAUX = 'Rencontre avec les animaux';
    let participantsHtml = '';
    if (atelier.nom === NOM_ANIMAUX && agesEnfants && agesEnfants.length > 0) {
      const nbEnfants  = agesEnfants.length;
      const lignesAges = agesEnfants
        .map((a, i) => `Enfant ${i + 1} — âge : ${labelsAge[a] || a}`)
        .join('<br>');
      participantsHtml = `
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#E8F5EB;border-left:4px solid #1F6B2E;border-radius:4px;margin-bottom:20px;">
          <tr>
            <td style="padding:15px 20px;font-size:15px;color:#333;">
              <strong>Participants réservés :</strong><br>
              1 adulte et ${nbEnfants} enfant${nbEnfants > 1 ? 's' : ''}<br>
              <span style="color:#555;">${lignesAges}</span>
            </td>
          </tr>
        </table>`;
    } else if (nbPersonnes && nbPersonnes > 0) {
      participantsHtml = `
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#E8F5EB;border-left:4px solid #1F6B2E;border-radius:4px;margin-bottom:20px;">
          <tr>
            <td style="padding:15px 20px;font-size:15px;color:#333;">
              <strong>Participants réservés :</strong> ${nbPersonnes} place${nbPersonnes > 1 ? 's' : ''}
            </td>
          </tr>
        </table>`;
    }

    // -------------------------------------------------------
    //  CORPS DE L'EMAIL
    // -------------------------------------------------------
    const corps = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f7f0;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7f0;padding:30px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">

        <!-- En-tête -->
        <tr>
          <td style="background:#1F6B2E;padding:30px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:normal;">🌿 Réservation confirmée</h1>
          </td>
        </tr>

        <!-- Corps -->
        <tr>
          <td style="padding:35px 40px;">

            <p style="margin:0 0 20px;font-size:16px;color:#333;">Bonjour <strong>${escapeHtml(nom)}</strong>,</p>
            <p style="margin:0 0 25px;font-size:16px;color:#333;line-height:1.6;">
              Votre réservation est bien confirmée. Nous avons hâte de vous accueillir !
            </p>

            <!-- Récap atelier -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#E8F5EB;border-left:4px solid #1F6B2E;border-radius:4px;margin-bottom:16px;">
              <tr>
                <td style="padding:20px 25px;">
                  <p style="margin:0 0 8px;font-size:18px;color:#1F6B2E;font-weight:bold;">${escapeHtml(atelier.nom)}</p>
                  <p style="margin:0 0 5px;font-size:15px;color:#555;">📅 &nbsp;${dateLisible}</p>
                  <p style="margin:0;font-size:15px;color:#555;">🕐 &nbsp;${atelier.debut} – ${atelier.fin}</p>
                </td>
              </tr>
            </table>

            <!-- Boutons Agenda + Annulation -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td align="center">
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding:0 6px 0 0;">
                        <a href="${calendarUrl}" style="display:inline-block;padding:12px 20px;background:#ffffff;border:2px solid #2D8B3E;color:#2D8B3E;border-radius:8px;text-decoration:none;font-size:14px;font-weight:bold;">📅 Ajouter à mon agenda</a>
                      </td>
                      <td style="padding:0 0 0 6px;">
                        <a href="${cancelUrl}" style="display:inline-block;padding:12px 20px;background:#ffffff;border:2px solid #C0392B;color:#C0392B;border-radius:8px;text-decoration:none;font-size:14px;font-weight:bold;">✖ Annuler ma réservation</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Participants -->
            ${participantsHtml}

            <!-- Contact -->
            <p style="margin:0 0 10px;font-size:15px;color:#555;line-height:1.6;">
              Pour toute question, contactez-nous au
              <a href="tel:+33498009570" style="color:#1F6B2E;font-weight:bold;text-decoration:none;">04 98 00 95 70</a>
              ou à <a href="mailto:ecoferme@var.fr" style="color:#1F6B2E;text-decoration:underline;">ecoferme@var.fr</a>.
            </p>
            <p style="margin:0 0 0;font-size:15px;color:#555;line-height:1.6;">
              Pour que personne ne manque cette belle expérience, merci de nous prévenir par téléphone ou par mail si vous ne pouvez pas venir — quelqu'un d'autre sera heureux de prendre votre place !
            </p>

          </td>
        </tr>

        <!-- Pied de page -->
        <tr>
          <td style="background:#E8F5EB;padding:25px 40px;text-align:center;">

            <!-- Coordonnées -->
            <p style="margin:0 0 4px;font-size:14px;color:#333;">
              <a href="tel:+33498009570" style="color:#1F6B2E;font-weight:bold;text-decoration:none;">📞 04 98 00 95 70</a>
              &nbsp;|&nbsp;
              <a href="mailto:ecoferme@var.fr" style="color:#1F6B2E;text-decoration:none;">✉ ecoferme@var.fr</a>
            </p>
            <p style="margin:0 0 20px;font-size:14px;color:#333;">
              <a href="https://maps.google.com/?q=55+allée+Georges+Legg+83000+Toulon" style="color:#1F6B2E;text-decoration:none;">📍 55, allée Georges Legg, 83000 Toulon</a>
            </p>

            <!-- Boutons Facebook -->
            <table cellpadding="0" cellspacing="0" style="margin:0 auto 20px;">
              <tr>
                <td style="padding:0 6px 0 0;">
                  <a href="https://www.facebook.com/ecofermedudepartementduvar" style="display:inline-block;padding:10px 20px;background:#1877F2;color:#ffffff;border-radius:8px;text-decoration:none;font-size:14px;font-weight:bold;">👍 Notre page Facebook</a>
                </td>
                <td style="padding:0 0 0 6px;">
                  <a href="https://www.facebook.com/ecofermedudepartementduvar" style="display:inline-block;padding:10px 20px;background:#ffffff;border:2px solid #1877F2;color:#1877F2;border-radius:8px;text-decoration:none;font-size:14px;font-weight:bold;">🔔 Suivre notre actualité</a>
                </td>
              </tr>
            </table>

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
//  MENU PERSONNALISÉ dans Google Sheets
// ============================================================

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🎨 Ateliers')
    .addItem('Initialiser les onglets', 'initialiserSheet')
    .addToUi();
}
