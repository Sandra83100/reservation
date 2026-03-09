<?php
// ============================================================
//  CONFIGURATION BASE DE DONNÉES
// ============================================================
define('DB_HOST',          'localhost');
define('DB_NAME',          'masa4871_ateliers');
define('DB_USER',          'masa4871_user');
define('DB_PASS',          'Atel2026!SecureDb#');
define('SITE_URL',         'https://sandramarino.fr/reservation');
define('API_URL',          'https://sandramarino.fr/reservation/api');
define('EMAIL_FROM',       'noreply@sandramarino.fr');
define('EMAIL_FROM_NAME',  'Écoferme de la Barre');
define('EMAIL_CONTACT',    'ecoferme@var.fr');

date_default_timezone_set('Europe/Paris');

// ============================================================
//  CONNEXION PDO (singleton)
// ============================================================
function getDb(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $pdo = new PDO(
            'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
            DB_USER, DB_PASS,
            [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
                PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci",
            ]
        );
        initTables($pdo);
    }
    return $pdo;
}

// ============================================================
//  CRÉATION DES TABLES
// ============================================================
function initTables(PDO $pdo): void {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS ateliers (
            id              INT AUTO_INCREMENT PRIMARY KEY,
            nom             VARCHAR(255) NOT NULL,
            email_mediateur VARCHAR(255) DEFAULT NULL,
            date            DATE         NOT NULL,
            heure_debut     VARCHAR(10)  NOT NULL,
            heure_fin       VARCHAR(10)  NOT NULL,
            places_max      INT          NOT NULL DEFAULT 8,
            created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

        CREATE TABLE IF NOT EXISTS reservations (
            id           INT AUTO_INCREMENT PRIMARY KEY,
            atelier_id   INT          NOT NULL,
            nom_prenom   VARCHAR(255) NOT NULL,
            email        VARCHAR(255) NOT NULL,
            telephone    VARCHAR(30)  NOT NULL,
            nb_personnes INT          NOT NULL DEFAULT 1,
            ages_enfants TEXT         DEFAULT NULL,
            newsletter   TINYINT(1)   NOT NULL DEFAULT 0,
            soumis_le    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
            annulee      TINYINT(1)   NOT NULL DEFAULT 0,
            FOREIGN KEY (atelier_id) REFERENCES ateliers(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

        CREATE TABLE IF NOT EXISTS newsletter (
            id               INT AUTO_INCREMENT PRIMARY KEY,
            email            VARCHAR(255) NOT NULL UNIQUE,
            nom_prenom       VARCHAR(255) DEFAULT NULL,
            source_atelier   VARCHAR(255) DEFAULT NULL,
            date_inscription TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");
}

// ============================================================
//  UTILITAIRES DATES
// ============================================================

/** MySQL DATE (YYYY-MM-DD) → "DD/MM/YYYY" */
function formatDateFr(string $date): string {
    $d = new DateTime($date);
    return $d->format('d/m/Y');
}

/** MySQL DATE (YYYY-MM-DD) → "Mercredi 4 mars 2026" */
function formatDateLisible(string $date, bool $avecAnnee = true): string {
    $d    = new DateTime($date);
    $jours = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
    $mois  = ['janvier','février','mars','avril','mai','juin',
               'juillet','août','septembre','octobre','novembre','décembre'];
    $str = $jours[(int)$d->format('w')].' '.(int)$d->format('j').' '.$mois[(int)$d->format('n')-1];
    return $avecAnnee ? $str.' '.$d->format('Y') : $str;
}

/** MySQL DATE + heure "HH:MM" → format pour Google Calendar "YYYYMMDDTHHmmSS" */
function heureToGcal(string $date, string $heure): string {
    $d = new DateTime($date);
    return $d->format('Ymd') . 'T' . str_replace(':', '', $heure) . '00';
}

/** Nombre de places déjà réservées pour un atelier (somme nb_personnes) */
function placesReservees(PDO $pdo, int $atelierId): int {
    $stmt = $pdo->prepare(
        "SELECT COALESCE(SUM(nb_personnes), 0) FROM reservations WHERE atelier_id = ? AND annulee = 0"
    );
    $stmt->execute([$atelierId]);
    return (int)$stmt->fetchColumn();
}
