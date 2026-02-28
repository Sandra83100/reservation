// ============================================================
//  CONFIGURATION — à adapter si besoin
// ============================================================
const SHEET_ID = '1x6_cgQwlZaY6p8wAr6_VtGjdRiuEjWpnMWvUAh-Rh1k'; // ID de la Google Sheet
const ONGLET_ATELIERS      = 'Ateliers';
const ONGLET_RESERVATIONS  = 'Réservations';

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
    const obj = { _row: i + 2 }; // numéro de ligne réelle dans la sheet
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

/** Formate une valeur heure (peut être un objet Date ou une string "HH:MM") */
function formatTime(val) {
  if (!val && val !== 0) return '';
  if (val instanceof Date) {
    return val.toTimeString().slice(0, 5);
  }
  // Si c'est un nombre décimal (fraction de jour de Sheets) : peu probable ici
  return String(val);
}

/** Headers CORS pour répondre aux requêtes du site */
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
//  GET — Retourne la liste des ateliers avec places restantes
// ============================================================

function doGet(e) {
  try {
    const action = e && e.parameter && e.parameter.action;

    if (action === 'getAteliers') {
      return jsonResponse(getAteliers());
    }

    // Ping de santé
    return jsonResponse({ status: 'ok', message: 'API de réservation opérationnelle' });

  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

function getAteliers() {
  const sheetAteliers     = getSheet(ONGLET_ATELIERS);
  const sheetReservations = getSheet(ONGLET_RESERVATIONS);

  const ateliers     = sheetToObjects(sheetAteliers);
  const reservations = sheetToObjects(sheetReservations);

  // Compte les réservations par index d'atelier (colonne "ID Atelier")
  const compteur = {};
  reservations.forEach(r => {
    const id = r['ID Atelier'];
    if (id !== '' && id !== undefined) {
      compteur[id] = (compteur[id] || 0) + 1;
    }
  });

  return ateliers.map((a, i) => {
    const id          = i + 1; // id = numéro de ligne dans l'onglet (sans en-tête)
    const placesMax   = Number(a['Nb places max']) || 0;
    const reservees   = compteur[id] || 0;
    const restantes   = Math.max(0, placesMax - reservees);

    return {
      id:             id,
      nom:            a['Nom de l\'atelier'] || '',
      date:           formatDate(a['Date']),
      debut:          formatTime(a['Heure début']),
      fin:            formatTime(a['Heure fin']),
      placesMax:      placesMax,
      placesRestantes: restantes
    };
  });
}

// ============================================================
//  POST — Enregistre une nouvelle réservation
// ============================================================

function doPost(e) {
  try {
    // Support OPTIONS preflight CORS
    if (!e || !e.postData) {
      return jsonResponse({ error: 'Requête invalide' });
    }

    const body = JSON.parse(e.postData.contents);
    const { atelierId, nom, email, tel } = body;

    // --- Validation des champs ---
    if (!atelierId || !nom || !email || !tel) {
      return jsonResponse({ error: 'Tous les champs sont obligatoires.' });
    }

    // --- Récupération de l'atelier ---
    const ateliers = getAteliers();
    const atelier  = ateliers.find(a => a.id === Number(atelierId));

    if (!atelier) {
      return jsonResponse({ error: 'Atelier introuvable.' });
    }

    // --- Vérification des places ---
    if (atelier.placesRestantes <= 0) {
      return jsonResponse({ error: 'Cet atelier est complet.' });
    }

    // --- Protection anti-doublon ---
    const sheetResaCheck = getSheet(ONGLET_RESERVATIONS);
    const resasExistantes = sheetToObjects(sheetResaCheck);
    const dejaInscrit = resasExistantes.some(r =>
      r['Email'] && r['Email'].toString().toLowerCase().trim() === email.toLowerCase().trim() &&
      String(r['ID Atelier']) === String(atelierId)
    );
    if (dejaInscrit) {
      return jsonResponse({ error: 'Cette adresse email est déjà inscrite à cet atelier.' });
    }

    // --- Écriture dans l'onglet Réservations ---
    const sheet   = getSheet(ONGLET_RESERVATIONS);
    const lastRow = sheet.getLastRow();
    const newNum  = lastRow; // numéro auto (l'en-tête est ligne 1, donc lastRow = nb réservations)
    const now     = new Date();

    sheet.appendRow([
      newNum,
      atelier.nom,
      atelier.date,
      atelier.debut,
      atelier.fin,
      nom,
      email,
      tel,
      atelierId,        // ID Atelier (pour le comptage)
      Utilities.formatDate(now, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm')
    ]);

    // Applique le zébrage sur la nouvelle ligne
    appliquerZebrage(sheet, sheet.getLastRow());

    // --- Email de confirmation au participant ---
    envoyerEmailConfirmation(email, nom, atelier);

    return jsonResponse({
      success: true,
      message: `Votre place pour "${atelier.nom}" le ${atelier.date} de ${atelier.debut} à ${atelier.fin} est confirmée !`
    });

  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

// ============================================================
//  INITIALISATION — Lance une fois via le menu Feuille
//  pour créer les onglets et la mise en forme
// ============================================================

function initialiserSheet() {
  const ss = getSpreadsheet();
  creerOngletAteliers(ss);
  creerOngletReservations(ss);
  SpreadsheetApp.getUi().alert('✅ Initialisation terminée ! Les deux onglets sont prêts.');
}

function creerOngletAteliers(ss) {
  let sheet = ss.getSheetByName(ONGLET_ATELIERS);
  if (!sheet) {
    sheet = ss.insertSheet(ONGLET_ATELIERS);
  }

  sheet.clearFormats();
  sheet.clearContents();

  // En-têtes
  const headers = ['Nom de l\'atelier', 'Date', 'Heure début', 'Heure fin', 'Nb places max'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // Style en-tête
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange
    .setBackground('#4A6FA5')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');

  // Ligne figée
  sheet.setFrozenRows(1);

  // Largeurs de colonnes
  sheet.setColumnWidth(1, 200); // Nom atelier
  sheet.setColumnWidth(2, 120); // Date
  sheet.setColumnWidth(3, 110); // Heure début
  sheet.setColumnWidth(4, 110); // Heure fin
  sheet.setColumnWidth(5, 130); // Nb places

  // Exemples de données
  const exemples = [
    ['Poterie',   new Date(), '10:00', '12:30', 8],
    ['Aquarelle', new Date(), '14:00', '16:00', 6],
  ];
  sheet.getRange(2, 1, exemples.length, headers.length).setValues(exemples);

  // Format date sur colonne B
  sheet.getRange(2, 2, sheet.getMaxRows() - 1, 1).setNumberFormat('DD/MM/YYYY');

  // Bordures
  sheet.getRange(1, 1, sheet.getLastRow(), headers.length)
    .setBorder(true, true, true, true, true, true);
}

function creerOngletReservations(ss) {
  let sheet = ss.getSheetByName(ONGLET_RESERVATIONS);
  if (!sheet) {
    sheet = ss.insertSheet(ONGLET_RESERVATIONS);
  }

  sheet.clearFormats();
  sheet.clearContents();

  const headers = ['#', 'Atelier', 'Date', 'Heure début', 'Heure fin', 'Nom / Prénom', 'Email', 'Téléphone', 'ID Atelier', 'Soumis le'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // Style en-tête
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange
    .setBackground('#2E7D32')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');

  // Ligne figée
  sheet.setFrozenRows(1);

  // Largeurs de colonnes
  sheet.setColumnWidth(1, 40);   // #
  sheet.setColumnWidth(2, 180);  // Atelier
  sheet.setColumnWidth(3, 110);  // Date
  sheet.setColumnWidth(4, 110);  // Heure début
  sheet.setColumnWidth(5, 110);  // Heure fin
  sheet.setColumnWidth(6, 180);  // Nom
  sheet.setColumnWidth(7, 200);  // Email
  sheet.setColumnWidth(8, 130);  // Téléphone
  sheet.setColumnWidth(9, 100);  // ID Atelier
  sheet.setColumnWidth(10, 140); // Soumis le

  // Mise en page impression
  const ps = sheet.getPageProtection
    ? null
    : sheet;

  try {
    sheet.setHiddenGridlines(false);
    // Orientation paysage via SpreadsheetApp
    const printSettings = SpreadsheetApp.newPageMargins
      ? null
      : null;
  } catch(e) {}
}

/** Applique une couleur alternée sur une ligne donnée */
function appliquerZebrage(sheet, rowIndex) {
  const nbCols   = 10;
  const range    = sheet.getRange(rowIndex, 1, 1, nbCols);
  const couleur  = rowIndex % 2 === 0 ? '#F1F8E9' : '#FFFFFF';
  range.setBackground(couleur);
  range.setBorder(true, true, true, true, true, true);
}

// ============================================================
//  EMAIL DE CONFIRMATION
// ============================================================

/** Échappe les caractères HTML pour éviter les injections dans l'email */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function envoyerEmailConfirmation(email, nom, atelier) {
  try {
    const sujet = `✅ Confirmation — ${atelier.nom} le ${atelier.date}`;

    const corps = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f7f0;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7f0;padding:30px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">

        <!-- En-tête -->
        <tr>
          <td style="background:#3a6b35;padding:30px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:normal;">🌿 Réservation confirmée</h1>
          </td>
        </tr>

        <!-- Corps -->
        <tr>
          <td style="padding:35px 40px;">
            <p style="margin:0 0 20px;font-size:16px;color:#333;">Bonjour <strong>${escapeHtml(nom)}</strong>,</p>
            <p style="margin:0 0 25px;font-size:16px;color:#333;line-height:1.6;">
              Votre place est bien réservée. Nous avons hâte de vous accueillir !
            </p>

            <!-- Récap atelier -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f8e9;border-left:4px solid #3a6b35;border-radius:4px;margin-bottom:30px;">
              <tr>
                <td style="padding:20px 25px;">
                  <p style="margin:0 0 8px;font-size:18px;color:#2e5a2a;font-weight:bold;">${escapeHtml(atelier.nom)}</p>
                  <p style="margin:0 0 5px;font-size:15px;color:#555;">📅 &nbsp;${atelier.date}</p>
                  <p style="margin:0;font-size:15px;color:#555;">🕐 &nbsp;${atelier.debut} – ${atelier.fin}</p>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 10px;font-size:15px;color:#555;line-height:1.6;">
              En cas de question ou si vous souhaitez annuler, répondez simplement à cet email.
            </p>
            <p style="margin:0;font-size:15px;color:#555;line-height:1.6;">
              À très bientôt,<br>
              <strong style="color:#3a6b35;">L'équipe de l'Écoferme</strong>
            </p>
          </td>
        </tr>

        <!-- Pied de page -->
        <tr>
          <td style="background:#f4f7f0;padding:15px 40px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#999;">Cet email a été envoyé automatiquement suite à votre réservation.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    MailApp.sendEmail({
      to:      email,
      subject: sujet,
      htmlBody: corps
    });

  } catch (err) {
    // L'email échoue silencieusement — la réservation reste enregistrée
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
