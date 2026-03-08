<?php
// ============================================================
//  CRON — Récap quotidien médiateurs (à exécuter à 8h15)
//  Commande cPanel : php /home/masa4871/public_html/reservation/api/cron.php
// ============================================================
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/mail.php';

// Sécurité : n'autoriser l'exécution qu'en CLI ou depuis localhost
$isCli  = PHP_SAPI === 'cli';
$isLocal = ($_SERVER['REMOTE_ADDR'] ?? '') === '127.0.0.1';

if (!$isCli && !$isLocal) {
    http_response_code(403);
    echo json_encode(['error' => 'Accès interdit']);
    exit;
}

$pdo  = getDb();
$today = (new DateTime())->format('Y-m-d');

echo "[cron] " . date('d/m/Y H:i:s') . " — Envoi récap médiateurs pour le {$today}\n";

// Récupérer tous les ateliers d'aujourd'hui qui ont un email médiateur
$stmt = $pdo->prepare("
    SELECT * FROM ateliers
    WHERE date = ? AND email_mediateur IS NOT NULL AND email_mediateur != ''
    ORDER BY heure_debut ASC
");
$stmt->execute([$today]);
$ateliers = $stmt->fetchAll();

if (empty($ateliers)) {
    echo "[cron] Aucun atelier aujourd'hui (ou pas de médiateur configuré).\n";
    exit;
}

foreach ($ateliers as $atelier) {
    // Récupérer les réservations actives pour cet atelier
    $stmtR = $pdo->prepare("
        SELECT nom_prenom, telephone, nb_personnes
        FROM reservations
        WHERE atelier_id = ? AND annulee = 0
        ORDER BY soumis_le ASC
    ");
    $stmtR->execute([$atelier['id']]);
    $reservations = $stmtR->fetchAll();

    if (empty($reservations)) {
        echo "[cron] Atelier #{$atelier['id']} ({$atelier['nom']}) : aucun inscrit — pas d'envoi.\n";
        continue;
    }

    $ok = envoyerRecapMediateur($atelier['email_mediateur'], $atelier, $reservations);
    $total = array_sum(array_column($reservations, 'nb_personnes'));
    $emoji = $ok ? '✅' : '❌';
    echo "[cron] {$emoji} Atelier #{$atelier['id']} ({$atelier['nom']}) → {$atelier['email_mediateur']} ({$total} participants)\n";
}

echo "[cron] Terminé.\n";
