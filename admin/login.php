<?php
// ============================================================
//  ADMIN — Page de connexion
//  URL : https://sandramarino.fr/reservation/admin/login.php
//  Mot de passe : ecoferme2026
// ============================================================
session_start();

if (isset($_SESSION['admin_ok'])) {
    header('Location: index.php');
    exit;
}

// Hash SHA-256 de 'ecoferme2026'
define('ADMIN_HASH', '597e9124949f0f110af29d433f34ae49e154ccee9569330472e0cc21d39b2990');

$erreur = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $mdp = trim($_POST['password'] ?? '');
    if (hash_equals(ADMIN_HASH, hash('sha256', $mdp))) {
        $_SESSION['admin_ok'] = true;
        session_regenerate_id(true);
        header('Location: index.php');
        exit;
    } else {
        $erreur = 'Mot de passe incorrect.';
    }
}
?>
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Admin — Connexion</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; background: #f0f7f1; display: flex;
           align-items: center; justify-content: center; min-height: 100vh; }
    .card { background: white; padding: 40px; border-radius: 12px;
            box-shadow: 0 4px 16px rgba(0,0,0,.12); width: 100%; max-width: 380px; }
    h1 { color: #1F6B2E; font-size: 22px; margin-bottom: 8px; text-align: center; }
    .subtitle { color: #888; font-size: 13px; text-align: center; margin-bottom: 28px; }
    label { display: block; font-size: 13px; color: #555; margin-bottom: 6px; }
    input[type=password] { width: 100%; padding: 12px 14px; border: 1px solid #ddd;
      border-radius: 6px; font-size: 15px; transition: border .2s; }
    input[type=password]:focus { outline: none; border-color: #1F6B2E; }
    button { width: 100%; padding: 13px; background: #1F6B2E; color: white; border: none;
             border-radius: 6px; font-size: 15px; font-weight: bold; cursor: pointer;
             margin-top: 20px; transition: background .2s; }
    button:hover { background: #155221; }
    .erreur { background: #FFF0F0; border: 1px solid #FFCDD2; color: #C62828;
              padding: 10px 14px; border-radius: 6px; font-size: 13px; margin-top: 14px; }
    .logo { text-align: center; margin-bottom: 20px; font-size: 32px; }
  </style>
</head>
<body>
<div class="card">
  <div class="logo">🌿</div>
  <h1>Administration</h1>
  <p class="subtitle">Écoferme de la Barre — Ateliers</p>

  <form method="post" autocomplete="off">
    <label for="password">Mot de passe</label>
    <input type="password" id="password" name="password" autofocus placeholder="••••••••••">
    <button type="submit">Se connecter</button>
  </form>

  <?php if ($erreur): ?>
    <div class="erreur"><?= htmlspecialchars($erreur) ?></div>
  <?php endif; ?>
</div>
</body>
</html>
