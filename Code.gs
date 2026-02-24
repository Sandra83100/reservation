// ============================================================
//  CONFIGURATION — à adapter si besoin
// ============================================================
const SHEET_ID = ''; // Laisse vide si le script est lié à la Sheet (recommandé)
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
//  MENU PERSONNALISÉ dans Google Sheets
// ============================================================

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🎨 Ateliers')
    .addItem('Initialiser les onglets', 'initialiserSheet')
    .addToUi();
}
