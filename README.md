# Pronote → Calendrier iPhone 📅

Ton emploi du temps Pronote dans l'app **Calendrier** de l'iPhone, **mis à jour automatiquement**
(toutes les 30 min en journée), même quand ton PC est éteint.

Pour chaque cours :

| Ce que tu vois | Exemple |
|---|---|
| Matière (titre) | `MATHÉMATIQUES` |
| Prof absent / cours annulé | `❌ ANNULÉ – PHYSIQUE-CHIMIE (Prof. absent)` |
| Changement (salle, remplacement…) | `⚠️ – MATHÉMATIQUES (Changement de salle)` |
| Devoir surveillé | `📝 DS – HISTOIRE-GÉO` |
| Retenues | `🚨 Retenue – Travail non fait` |
| Salle | dans le champ « Lieu » |
| Prof, groupe, mémo, lien visio | dans les notes de l'événement |
| Couleur de la matière | un calendrier par matière (ou un carré 🟦🟧🟩 dans le titre) |

Si un prof est déclaré absent, ou qu'un cours bouge ou change de salle, l'iPhone se met à jour tout seul.

---

## Comment ça marche

```
Pronote ──(toutes les 30 min)──► GitHub Actions ──► Gist secret (.ics) ◄──(abonnement)── iPhone
```

- **GitHub Actions** lance le script dans le cloud (gratuit).
- Les calendriers sont publiés dans un **Gist secret** : c'est un lien que personne ne peut deviner.
- La connexion à Pronote se fait avec le **QR code de l'appli mobile**, ce qui marche avec **tous les ENT**.
  Ton mot de passe ENT n'est jamais enregistré nulle part.
- Le « jeton » Pronote est stocké **chiffré** (AES-256). Seul ton dépôt GitHub a la clé.

---

## Installation (≈ 15 min, une seule fois)

### 0. Ce qu'il te faut
- Un compte **GitHub** (gratuit) : https://github.com/signup
- **Node.js 20 ou plus** sur ton PC : https://nodejs.org (bouton « LTS »)

### 1. Mettre le projet sur GitHub (en **privé**)
1. Sur GitHub : **New repository** › nom `pronote-ical` › coche **Private** › *Create repository*.
2. Sur la page du dépôt vide, clique **uploading an existing file** et glisse **tout le contenu** de ce dossier
   (y compris le dossier `.github`), **sauf** `node_modules`, `sortie` et `mes-secrets.txt`.
   *(Si tu connais git : `git init`, `git add .`, `git commit`, `git push`, c'est pareil.)*

> ⚠️ Le dossier `.github` est caché sous Windows/Mac. Sous Windows : Explorateur › Affichage › Afficher › *Éléments masqués*.

### 2. Se connecter à Pronote (sur ton PC)
Ouvre un terminal **dans ce dossier** et tape :

```bash
npm install
```

```bash
npm run setup
```

Puis suis les instructions :
1. Ouvre Pronote dans ton navigateur (par ton ENT, comme d'habitude).
2. Clique sur l'icône **QR code / téléphone** en haut de la page, choisis un **code à 4 chiffres**.
3. Fais une **capture d'écran** du QR code et **glisse le fichier** dans le terminal, puis Entrée.
4. Tape ton code à 4 chiffres.
5. Crée le token GitHub avec le lien affiché (case **gist** seulement), puis colle-le.

À la fin, le script affiche **3 secrets** et **les liens des calendriers**. Ils sont aussi enregistrés dans
`mes-secrets.txt`, qui reste sur ton PC.

### 3. Donner les secrets à GitHub
Dans ton dépôt : **Settings › Secrets and variables › Actions › New repository secret**. Crée :

| Name | Valeur |
|---|---|
| `GIST_ID` | (affiché par le setup) |
| `GIST_TOKEN` | ton token GitHub `ghp_…` |
| `CLE_ETAT` | (affiché par le setup) |

Ensuite, va dans l'onglet **Actions** › *Synchro Pronote → iPhone* › **Run workflow**. Au bout d'environ 1 min,
la coche doit être verte ✅. Ensuite ça tourne tout seul.

### 4. Ajouter les calendriers sur l'iPhone
**Réglages › Calendrier › Comptes › Ajouter un compte › Autre › Ajouter un calendrier avec abonnement**,
puis colle un lien de `mes-secrets.txt` (envoie-le toi par mail ou AirDrop) › *Suivant* › *Enregistrer*.

Deux façons de faire :
- **Avec les couleurs (recommandé)** : ajoute **un lien par matière** (`matiere-….ics`), plus `retenues.ics`.
  Chaque matière est un calendrier séparé, et tu choisis sa couleur dans l'app Calendrier › *Calendriers* › (i).
- **Rapide** : ajoute seulement `emploi-du-temps.ics`. Tout tient dans un seul calendrier, et la couleur de la matière
  apparaît sous forme de carré 🟦🟧🟩 au début du titre.

Pour une mise à jour plus fréquente sur l'iPhone : **Réglages › Calendrier › Comptes › Nouvelles données**
› mets *Push* ou *Toutes les 15 minutes*.

> 💡 Si tu ajoutes les abonnements depuis un Mac (Calendrier › Fichier › Nouvel abonnement) avec « Emplacement : iCloud »,
> ils apparaissent aussi sur l'iPhone et tu peux régler « Actualiser : toutes les 15 minutes ».

---

## Options

Dans le dépôt : **Settings › Secrets and variables › Actions › onglet Variables › New repository variable**

| Variable | Valeur par défaut | Effet |
|---|---|---|
| `AFFICHER_ANNULES` | `oui` | `non` : les cours annulés **disparaissent** au lieu d'afficher « ❌ ANNULÉ » |
| `SEMAINES_APRES` | `8` | nombre de semaines à venir dans le calendrier |
| `SEMAINES_AVANT` | `1` | semaines passées gardées |

---

## En cas de problème

- **GitHub t'envoie un mail « Run failed »** : en général, la connexion Pronote a expiré (changement de mot de passe,
  début d'année, Pronote réinitialisé…). Refais la connexion **en gardant le même Gist**, pour que les abonnements
  iPhone continuent de marcher :

  ```bash
  GIST_ID=ton_gist_id npm run setup
  ```

  Sous PowerShell (Windows) : `$env:GIST_ID="ton_gist_id"; npm run setup`

  Ensuite, mets à jour le secret **`CLE_ETAT`** (et `GIST_TOKEN` si tu as changé de token) dans GitHub.
- **Un cours n'apparaît pas** : lance la synchro à la main (Actions › Run workflow) et regarde le journal.
  Il liste les matières trouvées.
- **Vérifier le format sans Pronote** : `npm test` génère un faux emploi du temps dans `sortie/`.

## Sécurité
- Le dépôt doit rester **privé**.
- Ne partage jamais `mes-secrets.txt`, ni le lien d'un calendrier, à quelqu'un dont tu ne veux pas qu'il voie ton emploi du temps.
- Le token GitHub n'a que le droit « gist » : il ne peut rien faire d'autre sur ton compte.

## Licence
© 2026 Sc4ros. Tous droits réservés. Voir le fichier [LICENSE](LICENSE).

Composants tiers : ils ne sont pas inclus dans ce dépôt (npm les installe) et gardent leur propre licence :
- [pawnote](https://www.npmjs.com/package/pawnote) : GPL-3.0-or-later
- [jimp](https://www.npmjs.com/package/jimp) : MIT
- [jsqr](https://www.npmjs.com/package/jsqr) : Apache-2.0

Projet non officiel, sans lien avec Index Éducation (éditeur de PRONOTE).
