<?php
require_once __DIR__ . '/db.php';

// ============================================================
//  ENVOI EMAIL — wrapper UTF-8 + HTML
// ============================================================
function envoyerEmail(string $to, string $subject, string $htmlBody): bool {
    $encodedFrom    = '=?UTF-8?B?' . base64_encode(EMAIL_FROM_NAME) . '?=';
    $encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';

    $headers  = "MIME-Version: 1.0\r\n";
    $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
    $headers .= "Content-Transfer-Encoding: quoted-printable\r\n";
    $headers .= "From: {$encodedFrom} <" . EMAIL_FROM . ">\r\n";
    $headers .= "Reply-To: " . EMAIL_CONTACT . "\r\n";
    $headers .= "X-Mailer: PHP/" . PHP_VERSION . "\r\n";

    $body = quoted_printable_encode($htmlBody);

    return mail($to, $encodedSubject, $body, $headers);
}

// ============================================================
//  ICÔNES SVG AGENDA (email-compatible)
// ============================================================
function svgGoogle(): string {
    return '<svg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="60" height="60" rx="8" fill="#ffffff" stroke="#e0e0e0" stroke-width="1"/>
  <rect x="0" y="0" width="30" height="30" rx="8" fill="#4285F4"/>
  <rect x="30" y="0" width="30" height="30" rx="0" fill="#EA4335"/>
  <rect x="0" y="30" width="30" height="30" rx="0" fill="#34A853"/>
  <rect x="30" y="30" width="30" height="30" rx="0" fill="#FBBC05"/>
  <rect x="30" y="0" width="0" height="30" rx="8" fill="none"/>
  <circle cx="46" cy="46" r="10" fill="#1F6B2E"/>
  <text x="46" y="51" text-anchor="middle" font-size="16" font-weight="bold" fill="white" font-family="Arial">+</text>
</svg>';
}

function svgApple(string $date): string {
    $d    = new DateTime($date);
    $mois = strtoupper(['JANV','FÉVR','MARS','AVR','MAI','JUIN',
                        'JUIL','AOÛT','SEPT','OCT','NOV','DÉC'][(int)$d->format('n')-1]);
    $jour = (int)$d->format('j');
    return '<svg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="60" height="60" rx="8" fill="#ffffff" stroke="#e0e0e0" stroke-width="1"/>
  <rect x="0" y="0" width="60" height="18" rx="8" fill="#E53935"/>
  <rect x="0" y="10" width="60" height="8" fill="#E53935"/>
  <text x="30" y="14" text-anchor="middle" font-size="9" font-weight="bold" fill="white" font-family="Arial">' . $mois . '</text>
  <text x="30" y="46" text-anchor="middle" font-size="26" font-weight="bold" fill="#1a1a1a" font-family="Arial">' . $jour . '</text>
  <circle cx="46" cy="46" r="10" fill="#E53935"/>
  <text x="46" y="51" text-anchor="middle" font-size="16" font-weight="bold" fill="white" font-family="Arial">+</text>
</svg>';
}

function svgOutlook(): string {
    return '<svg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="60" height="60" rx="8" fill="#0078D4"/>
  <rect x="10" y="14" width="40" height="34" rx="4" fill="white" opacity="0.2"/>
  <rect x="10" y="14" width="40" height="9" rx="4" fill="white" opacity="0.4"/>
  <line x1="22" y1="29" x2="22" y2="44" stroke="white" stroke-width="1.5" opacity="0.6"/>
  <line x1="34" y1="29" x2="34" y2="44" stroke="white" stroke-width="1.5" opacity="0.6"/>
  <line x1="10" y1="33" x2="50" y2="33" stroke="white" stroke-width="1.5" opacity="0.6"/>
  <line x1="10" y1="39" x2="50" y2="39" stroke="white" stroke-width="1.5" opacity="0.6"/>
  <circle cx="46" cy="46" r="10" fill="#0063B1"/>
  <text x="46" y="51" text-anchor="middle" font-size="16" font-weight="bold" fill="white" font-family="Arial">+</text>
</svg>';
}

// ============================================================
//  EMAIL DE CONFIRMATION DE RÉSERVATION
// ============================================================
function envoyerEmailConfirmation(array $atelier, array $reservation): bool {
    $nom         = htmlspecialchars($reservation['nom_prenom']);
    $prenom      = explode(' ', $nom)[0];
    $email       = $reservation['email'];
    $nbPersonnes = (int)$reservation['nb_personnes'];
    $agesEnfants = $reservation['ages_enfants'] ? json_decode($reservation['ages_enfants'], true) : [];

    $nomAtelier  = htmlspecialchars($atelier['nom']);
    $dateLisible = formatDateLisible($atelier['date'], true);
    $heureDebut  = htmlspecialchars($atelier['heure_debut']);
    $heureFin    = htmlspecialchars($atelier['heure_fin']);

    // Token d'annulation : base64(email|atelierId)
    $token          = base64_encode($email . '|' . $atelier['id']);
    $urlAnnulation  = SITE_URL . '/?action=annuler&token=' . urlencode($token);

    // URLs calendrier
    $gcalStart  = heureToGcal($atelier['date'], $atelier['heure_debut']);
    $gcalEnd    = heureToGcal($atelier['date'], $atelier['heure_fin']);
    $gcalTitle  = urlencode($atelier['nom'] . ' — Écoferme de la Barre');
    $gcalLoc    = urlencode('265 allée Georges Leygues, 83000 Toulon');
    $gcalDesc   = urlencode('Réservation confirmée — Écoferme départementale de la Barre');
    $urlGcal    = "https://www.google.com/calendar/render?action=TEMPLATE&text={$gcalTitle}&dates={$gcalStart}/{$gcalEnd}&location={$gcalLoc}&details={$gcalDesc}";
    $urlIcs     = API_URL . '/?action=ics&id=' . $atelier['id'];

    // Photo de l'atelier
    $photos = [
        'Rencontre avec les animaux'       => SITE_URL . '/images/animaux/Fine1.jpg',
        "Mémoires de l'écoferme"           => 'https://picsum.photos/seed/ferme77/700/400',
        "Visite découverte de l'Écoferme"  => 'https://picsum.photos/seed/ecoferme33/700/400',
    ];
    $photoUrl = $photos[$atelier['nom']] ?? '';

    // Bloc participants
    $nbEnfants = count($agesEnfants);
    $nbAdultes = $nbPersonnes - $nbEnfants;
    if ($nbEnfants > 0) {
        $labelsAge = ['moins-3ans' => 'moins de 3 ans', '3-10ans' => '3 à 10 ans', 'plus-10ans' => 'plus de 10 ans'];
        $agesStr   = array_map(fn($a) => $labelsAge[$a] ?? $a, $agesEnfants);
        $groupes   = array_count_values($agesStr);
        $agesLabel = implode(', ', array_map(fn($a, $n) => ($n > 1 ? $n . ' enfants ' : '1 enfant ') . $a, array_keys($groupes), $groupes));
        $participants = "{$nbAdultes} adulte" . ($nbAdultes > 1 ? 's' : '') . " et {$nbEnfants} enfant" . ($nbEnfants > 1 ? 's' : '') . " ({$agesLabel})";
    } else {
        $participants = "{$nbPersonnes} personne" . ($nbPersonnes > 1 ? 's' : '');
    }

    $sujet = '✅ Confirmation — ' . $atelier['nom'] . ' le ' . formatDateLisible($atelier['date'], false);

    $html = <<<HTML
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:20px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

  <!-- BLOC A — Bandeau vert -->
  <tr>
    <td style="background:#1F6B2E;padding:24px 32px;text-align:center;">
      <img src="{$_SITE_LOGO}" alt="Écoferme de la Barre" style="height:60px;display:inline-block;margin-bottom:12px;"><br>
      <span style="color:#ffffff;font-size:22px;font-weight:bold;">🎉 Réservation confirmée</span>
    </td>
  </tr>

  <!-- Photo de l'atelier -->
HTML;

    // Remplacer le placeholder logo
    $logoUrl = SITE_URL . '/logo-ecoferme.png';
    $html    = str_replace('{$_SITE_LOGO}', $logoUrl, $html);

    if ($photoUrl) {
        $html .= <<<HTML
  <tr>
    <td style="padding:0;text-align:center;">
      <img src="{$photoUrl}" alt="{$nomAtelier}" style="width:100%;max-height:220px;object-fit:cover;display:block;">
    </td>
  </tr>
HTML;
    }

    $html .= <<<HTML

  <!-- BLOC B — Bonjour -->
  <tr>
    <td style="padding:28px 32px 12px;">
      <p style="font-size:17px;color:#1F6B2E;font-weight:bold;margin:0 0 8px;">Bonjour {$prenom},</p>
      <p style="font-size:15px;color:#333;margin:0;">Votre place est bien réservée ! Voici le récapitulatif de votre réservation.</p>
    </td>
  </tr>

  <!-- BLOC C — Récapitulatif -->
  <tr>
    <td style="padding:12px 32px 12px;">
      <table width="100%" cellpadding="12" cellspacing="0" style="background:#F0F7F1;border-left:4px solid #1F6B2E;border-radius:4px;font-size:14px;color:#333;">
        <tr><td style="padding:14px 16px;">
          <p style="margin:0 0 8px;font-size:16px;font-weight:bold;color:#1F6B2E;">📌 {$nomAtelier}</p>
          <p style="margin:0 0 6px;">📅 <strong>{$dateLisible}</strong></p>
          <p style="margin:0 0 6px;">🕐 {$heureDebut} – {$heureFin}</p>
          <p style="margin:0 0 6px;">👤 Réservé par : <strong>{$nom}</strong></p>
          <p style="margin:0 0 6px;">👥 Participants : <strong>{$participants}</strong></p>
          <p style="margin:0;">📍 <a href="https://maps.google.com/?q=265+all%C3%A9e+Georges+Leygues+83000+Toulon" style="color:#1F6B2E;">55 allée Georges Leygues, 83400 Hyères</a><br>
          <span style="font-size:12px;color:#888;">(accès par le 265 allée Georges Leygues, 83000 Toulon)</span></p>
        </td></tr>
      </table>
    </td>
  </tr>

  <!-- BLOC E — Annulation -->
  <tr>
    <td style="padding:12px 32px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFF9F0;border:1px solid #FFE0B2;border-radius:6px;padding:12px 16px;">
        <tr><td style="padding:12px 16px;">
          <p style="margin:0 0 10px;font-size:14px;color:#7B3F00;">En cas d'empêchement, merci de nous prévenir pour libérer votre place.</p>
          <a href="{$urlAnnulation}" style="font-size:13px;color:#9E9E9E;text-decoration:none;">✖ Annuler ma réservation</a>
        </td></tr>
      </table>
    </td>
  </tr>

  <!-- BLOC D — Ajouter à l'agenda -->
  <tr>
    <td style="padding:12px 32px 8px;">
      <p style="font-size:15px;font-weight:bold;text-transform:uppercase;color:#333;margin:0 0 16px;letter-spacing:0.5px;">AJOUTER À MON AGENDA</p>
      <table cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:0 12px 0 0;text-align:center;">
            <a href="{$urlGcal}" target="_blank" style="text-decoration:none;display:inline-block;">
              {$_SVG_GOOGLE}
              <br><span style="font-size:11px;color:#555;display:block;margin-top:6px;">Google Agenda</span>
            </a>
          </td>
          <td style="padding:0 12px;text-align:center;">
            <a href="{$urlIcs}" style="text-decoration:none;display:inline-block;">
              {$_SVG_APPLE}
              <br><span style="font-size:11px;color:#555;display:block;margin-top:6px;">Apple Calendar</span>
            </a>
          </td>
          <td style="padding:0 0 0 12px;text-align:center;">
            <a href="{$urlIcs}" style="text-decoration:none;display:inline-block;">
              {$_SVG_OUTLOOK}
              <br><span style="font-size:11px;color:#555;display:block;margin-top:6px;">Outlook</span>
            </a>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- BLOC F — Message de courtoisie -->
  <tr>
    <td style="padding:20px 32px 12px;">
      <p style="font-size:14px;color:#555;margin:0 0 10px;">Nous vous souhaitons une belle visite à l'Écoferme !</p>
      <p style="font-size:14px;color:#555;margin:0;">Pour toute question, contactez-nous :</p>
      <p style="font-size:14px;margin:6px 0;">
        📞 <a href="tel:+33498009570" style="color:#1F6B2E;text-decoration:none;">04 98 00 95 70</a> &nbsp;|&nbsp;
        ✉️ <a href="mailto:ecoferme@var.fr" style="color:#1F6B2E;text-decoration:none;">ecoferme@var.fr</a>
      </p>
    </td>
  </tr>

  <!-- BLOC G — Footer -->
  <tr>
    <td style="background:#E8F5EB;padding:20px 32px;border-top:1px solid #C8E6C9;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="font-size:12px;color:#555;vertical-align:top;">
            <strong style="color:#1F6B2E;">Écoferme départementale de la Barre</strong><br>
            📞 <a href="tel:+33498009570" style="color:#555;text-decoration:none;">04 98 00 95 70</a><br>
            ✉️ <a href="mailto:ecoferme@var.fr" style="color:#555;text-decoration:none;">ecoferme@var.fr</a><br>
            📍 <a href="https://maps.google.com/?q=265+all%C3%A9e+Georges+Leygues+83000+Toulon" style="color:#555;text-decoration:none;">265 allée Georges Leygues, 83000 Toulon</a><br><br>
            <a href="https://www.facebook.com/ecofermedepartementaledelabarre/" target="_blank"
               style="display:inline-block;background:#1877F2;color:white;padding:6px 14px;border-radius:4px;text-decoration:none;font-size:12px;font-weight:bold;">
              f &nbsp;Suivez notre actualité sur Facebook
            </a>
          </td>
          <td style="text-align:right;vertical-align:top;">
            <img src="{$_LOGO_DEP}" alt="Département du Var" style="height:55px;">
          </td>
        </tr>
        <tr>
          <td colspan="2" style="padding-top:14px;border-top:1px solid #C8E6C9;margin-top:14px;">
            <p style="font-size:11px;color:#9E9E9E;margin:10px 0 0;text-align:center;">
              Cet email a été envoyé automatiquement suite à votre réservation sur le site de l'Écoferme de la Barre.
              Vous ne souhaitez plus recevoir ces emails ? <a href="{$urlAnnulation}" style="color:#9E9E9E;">Annulez votre réservation</a>.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>

</table>
</td></tr></table>
</body>
</html>
HTML;

    // Injecter les SVG
    $html = str_replace('{$_SVG_GOOGLE}',  svgGoogle(),       $html);
    $html = str_replace('{$_SVG_APPLE}',   svgApple($atelier['date']), $html);
    $html = str_replace('{$_SVG_OUTLOOK}', svgOutlook(),      $html);
    $html = str_replace('{$_LOGO_DEP}',    SITE_URL . '/logo-departement.png', $html);

    return envoyerEmail($email, $sujet, $html);
}

// ============================================================
//  EMAIL RÉCAP MÉDIATEURS
// ============================================================
function envoyerRecapMediateur(string $emailMediateur, array $atelier, array $reservations): bool {
    $nomAtelier  = htmlspecialchars($atelier['nom']);
    $dateLisible = formatDateLisible($atelier['date'], true);
    $heureDebut  = htmlspecialchars($atelier['heure_debut']);
    $heureFin    = htmlspecialchars($atelier['heure_fin']);
    $total       = array_sum(array_column($reservations, 'nb_personnes'));
    $nbResas     = count($reservations);

    $lignes = '';
    foreach ($reservations as $i => $r) {
        $bg = ($i % 2 === 0) ? '#f9f9f9' : '#ffffff';
        $lignes .= '<tr style="background:'.$bg.';">'
            . '<td style="padding:8px 12px;border-bottom:1px solid #eee;">' . ($i + 1) . '</td>'
            . '<td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:bold;">' . htmlspecialchars($r['nom_prenom']) . '</td>'
            . '<td style="padding:8px 12px;border-bottom:1px solid #eee;">' . htmlspecialchars($r['telephone']) . '</td>'
            . '<td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">' . (int)$r['nb_personnes'] . '</td>'
            . '</tr>';
    }

    $html = <<<HTML
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:20px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <tr>
    <td style="background:#1F6B2E;padding:20px 32px;text-align:center;">
      <span style="color:#ffffff;font-size:20px;font-weight:bold;">📋 Liste des inscrits</span><br>
      <span style="color:#a5d6a7;font-size:15px;">{$nomAtelier}</span>
    </td>
  </tr>
  <tr>
    <td style="padding:20px 32px 12px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0F7F1;border-left:4px solid #1F6B2E;border-radius:4px;">
        <tr><td style="padding:12px 16px;font-size:14px;color:#333;">
          <p style="margin:0 0 6px;">📅 <strong>{$dateLisible}</strong></p>
          <p style="margin:0 0 6px;">🕐 {$heureDebut} – {$heureFin}</p>
          <p style="margin:0;font-size:16px;">👥 <strong>{$total} participant{$_S}</strong> ({$nbResas} réservation{$_S2})</p>
        </td></tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:12px 32px 24px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e0e0e0;border-radius:4px;font-size:14px;">
        <thead>
          <tr style="background:#1F6B2E;color:white;">
            <th style="padding:10px 12px;text-align:left;font-weight:normal;">#</th>
            <th style="padding:10px 12px;text-align:left;font-weight:normal;">Nom / Prénom</th>
            <th style="padding:10px 12px;text-align:left;font-weight:normal;">Téléphone</th>
            <th style="padding:10px 12px;text-align:center;font-weight:normal;">Nb</th>
          </tr>
        </thead>
        <tbody>
          {$lignes}
        </tbody>
      </table>
    </td>
  </tr>
  <tr>
    <td style="background:#E8F5EB;padding:16px 32px;border-top:1px solid #C8E6C9;text-align:center;">
      <p style="font-size:12px;color:#555;margin:0;">
        📞 <a href="tel:+33498009570" style="color:#1F6B2E;">04 98 00 95 70</a> &nbsp;|&nbsp;
        ✉️ <a href="mailto:ecoferme@var.fr" style="color:#1F6B2E;">ecoferme@var.fr</a>
      </p>
      <p style="font-size:11px;color:#9E9E9E;margin:8px 0 0;">Email généré automatiquement chaque matin à 8h15.</p>
    </td>
  </tr>
</table>
</td></tr></table>
</body>
</html>
HTML;

    $s  = $total > 1 ? 's' : '';
    $s2 = $nbResas > 1 ? 's' : '';
    $html = str_replace('{$_S}', $s, $html);
    $html = str_replace('{$_S2}', $s2, $html);

    $sujet = '📋 Inscrits du jour — ' . $atelier['nom'] . ' (' . $dateLisible . ')';
    return envoyerEmail($emailMediateur, $sujet, $html);
}
