<?php
// ============================================================
//  API PRINCIPALE — remplace Google Apps Script
//  GET  ?action=getAteliers          → liste ateliers + places
//  GET  ?action=annulerJson&token=.. → annulation JSON
//  GET  ?action=annuler&token=..     → annulation page HTML
//  GET  ?action=ics&id=N             → fichier .ics
//  POST (JSON body)                  → nouvelle réservation
// ============================================================
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/mail.php';

// Headers CORS + JSON par défaut
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ============================================================
//  DISPATCH
// ============================================================
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

try {
    if ($method === 'GET') {
        switch ($action) {
            case 'getAteliers':  handleGetAteliers(); break;
            case 'annulerJson':  handleAnnulerJson(); break;
            case 'annuler':      handleAnnulerPage(); break;
            case 'ics':          handleIcs();         break;
            default:             jsonError('Action inconnue', 400);
        }
    } elseif ($method === 'POST') {
        handlePost();
    } else {
        jsonError('Méthode non supportée', 405);
    }
} catch (Exception $e) {
    jsonError('Erreur serveur : ' . $e->getMessage(), 500);
}

// ============================================================
//  GET — Liste des ateliers avec places restantes
// ============================================================
function handleGetAteliers(): void {
    $pdo = getDb();
    $now = new DateTime();

    $stmt = $pdo->query("SELECT * FROM ateliers ORDER BY date ASC, heure_debut ASC");
    $rows = $stmt->fetchAll();

    $result = [];
    foreach ($rows as $a) {
        $reservees    = placesReservees($pdo, (int)$a['id']);
        $placesRest   = max(0, (int)$a['places_max'] - $reservees);

        // Fermeture à 8h le jour J
        $cutoff = new DateTime($a['date'] . ' 08:00:00');
        if ($now >= $cutoff) continue; // atelier clos → ne pas afficher

        $result[] = [
            'id'             => (int)$a['id'],
            'nom'            => $a['nom'],
            'date'           => formatDateFr($a['date']),   // "DD/MM/YYYY" pour le frontend
            'debut'          => $a['heure_debut'],
            'fin'            => $a['heure_fin'],
            'placesMax'      => (int)$a['places_max'],
            'placesRestantes'=> $placesRest,
        ];
    }

    jsonOk($result);
}

// ============================================================
//  POST — Nouvelle réservation
// ============================================================
function handlePost(): void {
    $raw  = file_get_contents('php://input');
    $data = json_decode($raw, true);

    if (!$data) {
        jsonError('Corps JSON invalide');
        return;
    }

    $atelierId   = (int)($data['atelierId'] ?? 0);
    $nom         = trim($data['nom'] ?? '');
    $email       = trim($data['email'] ?? '');
    $tel         = trim($data['tel'] ?? '');
    $nbPersonnes = (int)($data['nbPersonnes'] ?? 1);
    $newsletter  = !empty($data['newsletter']);
    $agesEnfants = $data['agesEnfants'] ?? [];

    // Validation basique
    if (!$atelierId || !$nom || !$email || !$tel || $nbPersonnes < 1) {
        jsonError('Champs manquants ou invalides');
        return;
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        jsonError('Adresse email invalide');
        return;
    }

    $pdo = getDb();

    // Récupérer l'atelier
    $stmt = $pdo->prepare("SELECT * FROM ateliers WHERE id = ?");
    $stmt->execute([$atelierId]);
    $atelier = $stmt->fetch();
    if (!$atelier) {
        jsonError("Atelier introuvable");
        return;
    }

    // Vérifier fermeture 8h
    $cutoff = new DateTime($atelier['date'] . ' 08:00:00');
    if (new DateTime() >= $cutoff) {
        jsonClos("Désolé, les inscriptions pour cet atelier sont closes.");
        return;
    }

    // Vérifier places disponibles
    $reservees = placesReservees($pdo, $atelierId);
    $dispo     = (int)$atelier['places_max'] - $reservees;
    if ($dispo <= 0) {
        jsonError("Désolé, il n'y a plus de places disponibles pour cet atelier.");
        return;
    }
    if ($nbPersonnes > $dispo) {
        jsonError("Il ne reste que {$dispo} place" . ($dispo > 1 ? 's' : '') . " disponible" . ($dispo > 1 ? 's' : '') . ".");
        return;
    }

    // Anti-doublon : même email + même atelier
    $stmtDup = $pdo->prepare(
        "SELECT id FROM reservations WHERE atelier_id = ? AND email = ? AND annulee = 0 LIMIT 1"
    );
    $stmtDup->execute([$atelierId, $email]);
    if ($stmtDup->fetch()) {
        jsonError("Cette adresse email a déjà une réservation pour cet atelier.");
        return;
    }

    // Enregistrer la réservation
    $agesJson = !empty($agesEnfants) ? json_encode($agesEnfants) : null;
    $ins = $pdo->prepare("
        INSERT INTO reservations (atelier_id, nom_prenom, email, telephone, nb_personnes, ages_enfants, newsletter)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ");
    $ins->execute([$atelierId, $nom, $email, $tel, $nbPersonnes, $agesJson, $newsletter ? 1 : 0]);

    // Inscription newsletter
    $dejaInscritNewsletter = false;
    if ($newsletter) {
        $stmtNl = $pdo->prepare("SELECT id FROM newsletter WHERE email = ? LIMIT 1");
        $stmtNl->execute([$email]);
        if ($stmtNl->fetch()) {
            $dejaInscritNewsletter = true;
        } else {
            $insNl = $pdo->prepare(
                "INSERT INTO newsletter (email, nom_prenom, source_atelier) VALUES (?, ?, ?)"
            );
            $insNl->execute([$email, $nom, $atelier['nom']]);
        }
    }

    // Préparer tableau réservation pour l'email
    $reservation = [
        'nom_prenom'  => $nom,
        'email'       => $email,
        'nb_personnes'=> $nbPersonnes,
        'ages_enfants'=> $agesJson,
    ];

    // Envoyer l'email de confirmation (non bloquant en cas d'erreur)
    envoyerEmailConfirmation($atelier, $reservation);

    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'success'              => true,
        'dejaInscritNewsletter'=> $dejaInscritNewsletter,
    ]);
    exit;
}

// ============================================================
//  GET — Annulation JSON (appelé par le frontend)
// ============================================================
function handleAnnulerJson(): void {
    $token = $_GET['token'] ?? '';
    [$email, $atelierId, $err] = parseToken($token);
    if ($err) {
        jsonError($err);
        return;
    }

    $pdo  = getDb();
    $stmt = $pdo->prepare(
        "SELECT id FROM reservations WHERE email = ? AND atelier_id = ? AND annulee = 0 LIMIT 1"
    );
    $stmt->execute([$email, $atelierId]);
    $resa = $stmt->fetch();

    if (!$resa) {
        jsonError("Aucune réservation active trouvée pour ce lien.");
        return;
    }

    $pdo->prepare("UPDATE reservations SET annulee = 1 WHERE id = ?")->execute([$resa['id']]);

    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['status' => 'ok']);
    exit;
}

// ============================================================
//  GET — Annulation page HTML (lien dans l'email)
// ============================================================
function handleAnnulerPage(): void {
    $token = $_GET['token'] ?? '';
    [$email, $atelierId, $err] = parseToken($token);

    if ($err) {
        pageCancellation('error', 'Lien d\'annulation invalide ou expiré.');
        return;
    }

    $pdo  = getDb();
    $stmt = $pdo->prepare("
        SELECT r.id, r.nom_prenom, a.nom, a.date, a.heure_debut, a.heure_fin
        FROM reservations r
        JOIN ateliers a ON a.id = r.atelier_id
        WHERE r.email = ? AND r.atelier_id = ? AND r.annulee = 0
        LIMIT 1
    ");
    $stmt->execute([$email, $atelierId]);
    $resa = $stmt->fetch();

    if (!$resa) {
        pageCancellation('notfound', 'Aucune réservation active trouvée, ou déjà annulée.');
        return;
    }

    $pdo->prepare("UPDATE reservations SET annulee = 1 WHERE id = ?")->execute([$resa['id']]);

    $dateLisible = formatDateLisible($resa['date']);
    pageCancellation('ok', '', $resa['nom'], $resa['nom_prenom'], $dateLisible);
}

// ============================================================
//  GET — Fichier ICS (Apple Calendar / Outlook)
// ============================================================
function handleIcs(): void {
    $id  = (int)($_GET['id'] ?? 0);
    $pdo = getDb();

    $stmt = $pdo->prepare("SELECT * FROM ateliers WHERE id = ?");
    $stmt->execute([$id]);
    $a = $stmt->fetch();

    if (!$a) {
        http_response_code(404);
        echo "Atelier non trouvé.";
        exit;
    }

    $d     = new DateTime($a['date']);
    $start = $d->format('Ymd') . 'T' . str_replace(':', '', $a['heure_debut']) . '00';
    $end   = $d->format('Ymd') . 'T' . str_replace(':', '', $a['heure_fin'])   . '00';
    $uid   = 'resa-' . $a['id'] . '-' . time() . '@sandramarino.fr';
    $now   = gmdate('Ymd\THis\Z');
    $nom   = str_replace(["\n","\r"], ' ', $a['nom']);

    $ics = "BEGIN:VCALENDAR\r\n"
         . "VERSION:2.0\r\n"
         . "PRODID:-//Ecoferme Ateliers//FR\r\n"
         . "CALSCALE:GREGORIAN\r\n"
         . "METHOD:PUBLISH\r\n"
         . "BEGIN:VEVENT\r\n"
         . "UID:{$uid}\r\n"
         . "DTSTAMP:{$now}\r\n"
         . "DTSTART;TZID=Europe/Paris:{$start}\r\n"
         . "DTEND;TZID=Europe/Paris:{$end}\r\n"
         . "SUMMARY:{$nom}\r\n"
         . "LOCATION:265 allee Georges Leygues\\, 83000 Toulon\r\n"
         . "DESCRIPTION:Réservé à l'Écoferme départementale de la Barre — 04 98 00 95 70\r\n"
         . "END:VEVENT\r\n"
         . "END:VCALENDAR\r\n";

    $filename = 'atelier-ecoferme-' . $a['date'] . '.ics';
    header('Content-Type: text/calendar; charset=UTF-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Content-Length: ' . strlen($ics));
    echo $ics;
    exit;
}

// ============================================================
//  UTILITAIRES
// ============================================================
function parseToken(string $token): array {
    if (!$token) return [null, null, 'Token manquant'];
    $decoded = base64_decode($token, true);
    if ($decoded === false) return [null, null, 'Token invalide'];
    $parts = explode('|', $decoded, 2);
    if (count($parts) !== 2) return [null, null, 'Token mal formé'];
    [$email, $atelierId] = $parts;
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || !(int)$atelierId) {
        return [null, null, 'Token invalide'];
    }
    return [$email, (int)$atelierId, null];
}

function jsonOk(mixed $data): void {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data);
    exit;
}

function jsonError(string $msg, int $code = 400): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => $msg]);
    exit;
}

function jsonClos(string $msg): void {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['clos' => true, 'message' => $msg]);
    exit;
}

function pageCancellation(string $status, string $msg, string $nomAtelier = '', string $nomPersonne = '', string $date = ''): void {
    header('Content-Type: text/html; charset=utf-8');
    $title = $status === 'ok' ? 'Réservation annulée' : 'Annulation impossible';
    $color = $status === 'ok' ? '#1F6B2E' : '#C62828';
    $icon  = $status === 'ok' ? '✅' : '❌';
    $body  = $status === 'ok'
        ? "<p>Votre réservation pour <strong>" . htmlspecialchars($nomAtelier) . "</strong> du <strong>{$date}</strong> a bien été annulée.</p><p>Vous pouvez réserver à nouveau sur <a href=\"" . SITE_URL . "\">notre site</a>.</p>"
        : "<p>" . htmlspecialchars($msg) . "</p><p><a href=\"" . SITE_URL . "\">Retour à l'accueil</a></p>";

    echo "<!DOCTYPE html><html lang='fr'><head><meta charset='UTF-8'><meta name='viewport' content='width=device-width,initial-scale=1'>
<title>{$title}</title>
<style>body{font-family:Arial,sans-serif;margin:0;padding:40px 20px;background:#f5f5f5;text-align:center;}
.box{max-width:500px;margin:0 auto;background:white;padding:40px;border-radius:12px;box-shadow:0 2px 10px rgba(0,0,0,.1);}
h1{color:{$color};font-size:24px;}</style></head>
<body><div class='box'><h1>{$icon} {$title}</h1>{$body}</div></body></html>";
    exit;
}
