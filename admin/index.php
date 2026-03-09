<?php
// ============================================================
//  ADMIN — Interface de gestion
//  Onglet 1 : Ateliers (CRUD)
//  Onglet 2 : Réservations (lecture + annulation)
// ============================================================
session_start();
header('Content-Type: text/html; charset=UTF-8');
if (!isset($_SESSION['admin_ok'])) {
    header('Location: login.php');
    exit;
}

require_once __DIR__ . '/../api/db.php';

$pdo  = getDb();
$msg  = '';
$msgType = 'ok';

// ============================================================
//  ACTIONS POST
// ============================================================
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';

    // — Ajouter ou modifier un atelier
    if ($action === 'save_atelier') {
        $id     = (int)($_POST['id'] ?? 0);
        $nom    = trim($_POST['nom'] ?? '');
        $email  = trim($_POST['email_mediateur'] ?? '');
        $date   = $_POST['date'] ?? '';
        $debut  = $_POST['heure_debut'] ?? '';
        $fin    = $_POST['heure_fin'] ?? '';
        $places = (int)($_POST['places_max'] ?? 8);

        if (!$nom || !$date || !$debut || !$fin || $places < 1) {
            $msg = 'Tous les champs obligatoires doivent être remplis.';
            $msgType = 'err';
        } else {
            if ($id > 0) {
                $pdo->prepare("UPDATE ateliers SET nom=?, email_mediateur=?, date=?, heure_debut=?, heure_fin=?, places_max=? WHERE id=?")
                    ->execute([$nom, $email ?: null, $date, $debut, $fin, $places, $id]);
                $msg = "✅ Atelier modifié.";
            } else {
                $pdo->prepare("INSERT INTO ateliers (nom, email_mediateur, date, heure_debut, heure_fin, places_max) VALUES (?,?,?,?,?,?)")
                    ->execute([$nom, $email ?: null, $date, $debut, $fin, $places]);
                $msg = "✅ Atelier ajouté.";
            }
        }
    }

    // — Supprimer un atelier
    if ($action === 'delete_atelier') {
        $id = (int)($_POST['id'] ?? 0);
        $pdo->prepare("DELETE FROM ateliers WHERE id = ?")->execute([$id]);
        $msg = "🗑 Atelier supprimé (et toutes ses réservations).";
    }

    // — Annuler une réservation
    if ($action === 'annuler_resa') {
        $id = (int)($_POST['id'] ?? 0);
        $pdo->prepare("UPDATE reservations SET annulee = 1 WHERE id = ?")->execute([$id]);
        $msg = "✅ Réservation annulée.";
    }
}

// ============================================================
//  DONNÉES
// ============================================================
$onglet = $_GET['tab'] ?? 'ateliers';

// Ateliers
$ateliers = $pdo->query("SELECT * FROM ateliers ORDER BY date ASC, heure_debut ASC")->fetchAll();

// Réservations
$filtreAtelier = (int)($_GET['atelier'] ?? 0);
$sqlResa = "SELECT r.*, a.nom AS nom_atelier, a.date, a.heure_debut, a.heure_fin
            FROM reservations r JOIN ateliers a ON a.id = r.atelier_id";
if ($filtreAtelier) {
    $stmtResa = $pdo->prepare($sqlResa . " WHERE r.atelier_id = ? ORDER BY r.annulee ASC, r.soumis_le ASC");
    $stmtResa->execute([$filtreAtelier]);
} else {
    $stmtResa = $pdo->query($sqlResa . " ORDER BY a.date ASC, a.heure_debut ASC, r.annulee ASC, r.soumis_le ASC");
}
$reservations = $stmtResa->fetchAll();

// Compter les places par atelier
$placesParAtelier = [];
foreach ($ateliers as $a) {
    $placesParAtelier[$a['id']] = placesReservees($pdo, (int)$a['id']);
}

// Atelier à éditer (si ?edit=N)
$editAtelier = null;
if (isset($_GET['edit'])) {
    $stmtE = $pdo->prepare("SELECT * FROM ateliers WHERE id = ?");
    $stmtE->execute([(int)$_GET['edit']]);
    $editAtelier = $stmtE->fetch();
}
?>
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Admin Ateliers — Écoferme</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; background: #f5f5f5; color: #333; }

    /* HEADER */
    .header { background: #1F6B2E; color: white; padding: 14px 24px;
              display: flex; align-items: center; gap: 16px; }
    .header h1 { font-size: 20px; font-weight: bold; }
    .header .spacer { flex: 1; }
    .header a { color: #a5d6a7; font-size: 13px; text-decoration: none; }
    .header a:hover { color: white; }

    /* TABS */
    .tabs { background: #155221; display: flex; gap: 0; }
    .tab { padding: 12px 28px; color: #a5d6a7; cursor: pointer; font-size: 14px;
           text-decoration: none; display: block; transition: background .2s; }
    .tab:hover, .tab.active { background: #0e3b17; color: white; }

    /* CONTENU */
    .content { max-width: 1100px; margin: 24px auto; padding: 0 16px; }

    /* MESSAGE */
    .msg { padding: 12px 16px; border-radius: 6px; margin-bottom: 20px; font-size: 14px; }
    .msg.ok  { background: #E8F5EB; color: #1F6B2E; border: 1px solid #C8E6C9; }
    .msg.err { background: #FFEBEE; color: #C62828; border: 1px solid #FFCDD2; }

    /* CARTE */
    .card { background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,.08);
            padding: 24px; margin-bottom: 24px; }
    .card h2 { font-size: 17px; color: #1F6B2E; margin-bottom: 18px; border-bottom: 2px solid #E8F5EB; padding-bottom: 10px; }

    /* FORMULAIRE ATELIER */
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .form-grid .full { grid-column: 1 / -1; }
    label { display: block; font-size: 12px; color: #666; margin-bottom: 4px; font-weight: bold; text-transform: uppercase; letter-spacing: .4px; }
    input, select { width: 100%; padding: 10px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; }
    input:focus, select:focus { outline: none; border-color: #1F6B2E; }
    .btn { padding: 10px 20px; border-radius: 6px; font-size: 14px; font-weight: bold;
           cursor: pointer; border: none; transition: background .2s; }
    .btn-primary { background: #1F6B2E; color: white; }
    .btn-primary:hover { background: #155221; }
    .btn-secondary { background: #eee; color: #555; }
    .btn-secondary:hover { background: #ddd; }
    .btn-danger { background: #f0f0f0; color: #777; border: 1px solid #ddd; }
    .btn-danger:hover { background: #FFEBEE; color: #C62828; border-color: #FFCDD2; }
    .btn-sm { padding: 6px 12px; font-size: 12px; }

    /* TABLEAU */
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th { background: #1F6B2E; color: white; padding: 10px 12px; text-align: left; font-weight: normal; }
    td { padding: 10px 12px; border-bottom: 1px solid #f0f0f0; vertical-align: middle; }
    tr:hover td { background: #fafff9; }
    .badge { display: inline-block; padding: 3px 8px; border-radius: 12px; font-size: 12px; font-weight: bold; }
    .badge-dispo  { background: #E8F5EB; color: #1F6B2E; }
    .badge-last   { background: #FFF8E1; color: #F57F17; }
    .badge-complet{ background: #FFEBEE; color: #C62828; }
    .badge-annul  { background: #F5F5F5; color: #9E9E9E; text-decoration: line-through; }
    .annulee td { color: #bbb; background: #fafafa; }

    /* FILTRE */
    .filtre { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
    .filtre select { width: auto; }
    .filtre label { margin-bottom: 0; }

    /* STATS */
    .stats { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
    .stat { background: white; border-radius: 8px; padding: 16px 20px; flex: 1; min-width: 140px;
            box-shadow: 0 1px 4px rgba(0,0,0,.08); text-align: center; }
    .stat .num { font-size: 28px; font-weight: bold; color: #1F6B2E; }
    .stat .lbl { font-size: 12px; color: #888; margin-top: 4px; }

    /* RESPONSIVE */
    @media (max-width: 640px) {
      .form-grid { grid-template-columns: 1fr; }
      .tabs .tab { padding: 10px 16px; font-size: 13px; }
    }
  </style>
</head>
<body>

<!-- HEADER -->
<div class="header">
  <div>🌿</div>
  <h1>Administration Écoferme</h1>
  <div class="spacer"></div>
  <a href="?tab=ateliers">Ateliers</a> &nbsp;|&nbsp;
  <a href="?tab=reservations">Réservations</a> &nbsp;|&nbsp;
  <a href="../" target="_blank">Voir le site</a> &nbsp;|&nbsp;
  <a href="logout.php">Déconnexion</a>
</div>

<!-- TABS -->
<div class="tabs">
  <a href="?tab=ateliers"     class="tab <?= $onglet === 'ateliers'     ? 'active' : '' ?>">📋 Ateliers</a>
  <a href="?tab=reservations" class="tab <?= $onglet === 'reservations' ? 'active' : '' ?>">📅 Réservations</a>
</div>

<div class="content">

  <?php if ($msg): ?>
    <div class="msg <?= $msgType ?>"><?= htmlspecialchars($msg) ?></div>
  <?php endif; ?>

  <!-- ======================================================
       ONGLET ATELIERS
  ======================================================= -->
  <?php if ($onglet === 'ateliers'): ?>

    <!-- Formulaire ajout / modification -->
    <div class="card">
      <h2><?= $editAtelier ? '✏️ Modifier l\'atelier' : '➕ Ajouter un atelier' ?></h2>
      <form method="post" action="?tab=ateliers">
        <input type="hidden" name="action" value="save_atelier">
        <input type="hidden" name="id" value="<?= (int)($editAtelier['id'] ?? 0) ?>">
        <div class="form-grid">
          <div class="full">
            <label>Nom de l'atelier *</label>
            <input type="text" name="nom" required value="<?= htmlspecialchars($editAtelier['nom'] ?? '') ?>"
                   placeholder="ex : Rencontre avec les animaux" list="noms-ateliers">
            <datalist id="noms-ateliers">
              <option value="Rencontre avec les animaux">
              <option value="Mémoires de l'écoferme">
              <option value="Visite découverte de l'Écoferme">
            </datalist>
          </div>
          <div class="full">
            <label>Email médiateur (optionnel)</label>
            <input type="email" name="email_mediateur" value="<?= htmlspecialchars($editAtelier['email_mediateur'] ?? '') ?>"
                   placeholder="ex : mediateur@ecoferme.fr">
          </div>
          <div>
            <label>Date *</label>
            <input type="date" name="date" required value="<?= htmlspecialchars($editAtelier['date'] ?? '') ?>">
          </div>
          <div>
            <label>Places max *</label>
            <input type="number" name="places_max" min="1" max="200" required value="<?= (int)($editAtelier['places_max'] ?? 8) ?>">
          </div>
          <div>
            <label>Heure début *</label>
            <input type="time" name="heure_debut" required value="<?= htmlspecialchars($editAtelier['heure_debut'] ?? '') ?>">
          </div>
          <div>
            <label>Heure fin *</label>
            <input type="time" name="heure_fin" required value="<?= htmlspecialchars($editAtelier['heure_fin'] ?? '') ?>">
          </div>
          <div class="full" style="display:flex;gap:10px;margin-top:6px;">
            <button type="submit" class="btn btn-primary"><?= $editAtelier ? '💾 Enregistrer' : '➕ Ajouter' ?></button>
            <?php if ($editAtelier): ?>
              <a href="?tab=ateliers" class="btn btn-secondary">Annuler</a>
            <?php endif; ?>
          </div>
        </div>
      </form>
    </div>

    <!-- Liste des ateliers -->
    <div class="card">
      <h2>📋 Tous les ateliers</h2>
      <?php if (empty($ateliers)): ?>
        <p style="color:#888;font-size:14px;">Aucun atelier pour le moment.</p>
      <?php else: ?>
        <table>
          <thead>
            <tr>
              <th>Atelier</th>
              <th>Date</th>
              <th>Horaires</th>
              <th>Places</th>
              <th>Médiateur</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <?php foreach ($ateliers as $a):
              $reservees  = $placesParAtelier[$a['id']];
              $restantes  = (int)$a['places_max'] - $reservees;
              $pct        = $restantes <= 0 ? 'complet' : ($restantes <= 2 ? 'last' : 'dispo');
              $badgeTxt   = $restantes <= 0 ? 'Complet' : "{$restantes}/{$a['places_max']}";
              $dateAffich = formatDateLisible($a['date'], false) . ' ' . (new DateTime($a['date']))->format('Y');
            ?>
            <tr>
              <td><strong><?= htmlspecialchars($a['nom']) ?></strong></td>
              <td><?= $dateAffich ?></td>
              <td><?= htmlspecialchars($a['heure_debut']) ?> – <?= htmlspecialchars($a['heure_fin']) ?></td>
              <td><span class="badge badge-<?= $pct ?>"><?= $badgeTxt ?></span></td>
              <td style="color:#888;font-size:13px;"><?= $a['email_mediateur'] ? htmlspecialchars($a['email_mediateur']) : '—' ?></td>
              <td style="white-space:nowrap;display:flex;gap:6px;">
                <a href="?tab=ateliers&edit=<?= $a['id'] ?>" class="btn btn-secondary btn-sm">✏️ Modifier</a>
                <form method="post" action="?tab=ateliers" onsubmit="return confirm('Supprimer cet atelier et toutes ses réservations ?');">
                  <input type="hidden" name="action" value="delete_atelier">
                  <input type="hidden" name="id" value="<?= $a['id'] ?>">
                  <button type="submit" class="btn btn-danger btn-sm">🗑</button>
                </form>
              </td>
            </tr>
            <?php endforeach; ?>
          </tbody>
        </table>
      <?php endif; ?>
    </div>

  <!-- ======================================================
       ONGLET RÉSERVATIONS
  ======================================================= -->
  <?php elseif ($onglet === 'reservations'): ?>

    <!-- Stats globales -->
    <?php
    $totalResas    = count(array_filter($reservations, fn($r) => !$r['annulee']));
    $totalPers     = array_sum(array_column(array_filter($reservations, fn($r) => !$r['annulee']), 'nb_personnes'));
    $totalAnnulees = count(array_filter($reservations, fn($r) => $r['annulee']));
    ?>
    <div class="stats">
      <div class="stat"><div class="num"><?= $totalResas ?></div><div class="lbl">Réservations actives</div></div>
      <div class="stat"><div class="num"><?= $totalPers ?></div><div class="lbl">Participants attendus</div></div>
      <div class="stat"><div class="num"><?= $totalAnnulees ?></div><div class="lbl">Annulées</div></div>
    </div>

    <!-- Filtre par atelier -->
    <div class="filtre">
      <label>Filtrer par atelier :</label>
      <form method="get" action="">
        <input type="hidden" name="tab" value="reservations">
        <select name="atelier" onchange="this.form.submit()">
          <option value="0">— Tous les ateliers —</option>
          <?php foreach ($ateliers as $a): ?>
            <option value="<?= $a['id'] ?>" <?= $filtreAtelier === (int)$a['id'] ? 'selected' : '' ?>>
              <?= htmlspecialchars($a['nom']) ?> — <?= formatDateLisible($a['date'], false) ?>
            </option>
          <?php endforeach; ?>
        </select>
      </form>
    </div>

    <!-- Tableau réservations -->
    <div class="card">
      <h2>📅 Réservations<?= $filtreAtelier ? ' — ' . htmlspecialchars($pdo->query("SELECT nom FROM ateliers WHERE id={$filtreAtelier}")->fetchColumn()) : '' ?></h2>
      <?php if (empty($reservations)): ?>
        <p style="color:#888;font-size:14px;">Aucune réservation.</p>
      <?php else: ?>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Atelier</th>
              <th>Date</th>
              <th>Nom / Prénom</th>
              <th>Email</th>
              <th>Téléphone</th>
              <th>Pers.</th>
              <th>Inscrit le</th>
              <th>Statut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <?php foreach ($reservations as $i => $r): ?>
            <tr class="<?= $r['annulee'] ? 'annulee' : '' ?>">
              <td><?= $r['id'] ?></td>
              <td><?= htmlspecialchars($r['nom_atelier']) ?></td>
              <td style="white-space:nowrap;"><?= formatDateLisible($r['date'], false) ?></td>
              <td><strong><?= htmlspecialchars($r['nom_prenom']) ?></strong></td>
              <td><a href="mailto:<?= htmlspecialchars($r['email']) ?>" style="color:#1F6B2E;"><?= htmlspecialchars($r['email']) ?></a></td>
              <td><?= htmlspecialchars($r['telephone']) ?></td>
              <td style="text-align:center;"><?= (int)$r['nb_personnes'] ?></td>
              <td style="font-size:12px;color:#888;white-space:nowrap;"><?= (new DateTime($r['soumis_le']))->format('d/m/Y H:i') ?></td>
              <td>
                <?php if ($r['annulee']): ?>
                  <span class="badge badge-annul">Annulée</span>
                <?php else: ?>
                  <span class="badge badge-dispo">Confirmée</span>
                <?php endif; ?>
              </td>
              <td>
                <?php if (!$r['annulee']): ?>
                  <form method="post" action="?tab=reservations<?= $filtreAtelier ? '&atelier='.$filtreAtelier : '' ?>"
                        onsubmit="return confirm('Annuler cette réservation ?');">
                    <input type="hidden" name="action" value="annuler_resa">
                    <input type="hidden" name="id" value="<?= $r['id'] ?>">
                    <button type="submit" class="btn btn-danger btn-sm">✖</button>
                  </form>
                <?php endif; ?>
              </td>
            </tr>
            <?php endforeach; ?>
          </tbody>
        </table>
      <?php endif; ?>
    </div>

  <?php endif; ?>
</div><!-- /content -->

</body>
</html>
