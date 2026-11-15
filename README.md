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
1. Sur GitHub, en haut à droite : **+** › **New repository** › nom `pronote-ical` › coche **Private** › *Create repository*.
2. Sur la page du dépôt vide, clique **uploading an existing file**.
3. Ouvre le dossier du projet sur ton PC, sélectionne **tout** (Ctrl + A) et glisse-le dans la page GitHub,
   **sauf** `node_modules`, `sortie` et `mes-secrets.txt` s'ils existent.
4. Laisse **Commit directly to the main branch** coché, puis clique **Commit changes**.

#### ⚠️ Le dossier `.github` ne s'envoie pas par glisser-déposer
GitHub refuse les dossiers qui commencent par un point quand on les glisse dans la page. Or ce dossier contient
le fichier qui lance la synchro automatique : **sans lui, rien ne se passe**. Il faut donc le créer à la main :

1. Sur la page de ton dépôt : **Add file** › **Create new file**.
2. Dans la case du nom, tape exactement `.github/workflows/sync.yml`
   (chaque `/` crée un dossier, tu verras le chemin se construire tout seul).
3. Sur ton PC, ouvre le fichier `.github/workflows/sync.yml` avec le Bloc-notes, **copie tout** et colle-le dans GitHub.
   > Tu ne vois pas le dossier `.github` ? Il est caché : Explorateur › *Affichage* › *Afficher* › **Éléments masqués**.
4. Clique **Commit changes…** puis **Commit changes**.
5. Vérifie : l'onglet **Actions** du dépôt doit maintenant afficher « Synchro Pronote → iPhone » à gauche.
   **Ne le lance pas encore** : il faut d'abord faire les étapes 2 et 3 ci-dessous.

*(Si tu connais git, `git init`, `git add .`, `git commit` puis `git push` envoient tout, `.github` compris.)*

À la fin, ton dépôt doit contenir :
```
.github/workflows/sync.yml
src/
test/
.gitignore
LICENSE
README.md
package-lock.json
package.json
```

### 2. Se connecter à Pronote (sur ton PC)
Ouvre un terminal **dans ce dossier** et tape :

```bash
npm install
```

> ℹ️ **npm affiche des avertissements (« deprecated », « vulnerabilities »…) ? Ce n'est pas grave.**
> Les outils qui servent seulement pendant la configuration (lecture et création de QR codes) tournent uniquement
> sur ton PC, et le robot GitHub ne les installe même pas.
> **Ne lance pas `npm audit fix --force`** : ça changerait des versions et pourrait casser le projet.

```bash
npm run setup
```

**Une page de configuration s'ouvre dans ton navigateur.** Elle tourne seulement sur ton PC, rien n'est mis en ligne.
Laisse la fenêtre noire ouverte pendant ce temps. Si la page ne s'ouvre pas, copie l'adresse `http://localhost:…`
affichée dans la fenêtre noire.

**① Connexion à Pronote**
1. Dans un autre onglet, ouvre Pronote (par ton ENT, comme d'habitude).
2. Clique sur l'icône **QR code / téléphone** en haut de la page et choisis un **code à 4 chiffres**.
3. Fais une capture d'écran avec <kbd>Windows</kbd> + <kbd>Maj</kbd> + <kbd>S</kbd>, reviens sur la page de configuration
   et **colle-la avec <kbd>Ctrl</kbd> + <kbd>V</kbd>**. Tu peux aussi **glisser** l'image ou cliquer pour la choisir.
4. « QR code Pronote détecté ✓ » s'affiche. Tape ton code à 4 chiffres, puis **Se connecter à Pronote**.

⏱ Le QR code expire au bout de quelques minutes : enchaîne vite. S'il a expiré, génère-en un nouveau dans Pronote
et colle-le à nouveau.

**② Créer tes calendriers**
1. Clique **Créer le token sur GitHub ↗**. Laisse seulement la case **gist** cochée, choisis l'expiration
   **No expiration**, clique **Generate token** et copie le code `ghp_…`.
2. Colle-le dans la page, puis clique **Créer mes calendriers**.

**③ Résultat**
La page affiche :
- les **3 secrets** à mettre dans GitHub, chacun avec un bouton **Copier** (étape 3 ci-dessous) ;
- **un QR code par calendrier**, à scanner avec l'iPhone (étape 4 ci-dessous).

Tout est aussi enregistré dans `mes-secrets.txt` et `mes-secrets.json`, qui restent sur ton PC.
**Garde-les en lieu sûr** : ils servent si un jour il faut refaire la connexion.

### 3. Donner les secrets à GitHub
Dans ton dépôt : **Settings › Secrets and variables › Actions › New repository secret**. Crée ces 3 secrets
avec les boutons **Copier** de la page de configuration :

| Name | Valeur |
|---|---|
| `GIST_ID` | (affiché par la page) |
| `GIST_TOKEN` | ton token GitHub `ghp_…` |
| `CLE_ETAT` | (affiché par la page) |

> Si l'outil [GitHub CLI](https://cli.github.com) (`gh`) est installé et connecté, la page propose un bouton pour les
> enregistrer automatiquement.

Ensuite, va dans l'onglet **Actions** › *Synchro Pronote → iPhone* › **Run workflow**. Au bout d'environ 1 min,
la coche doit être verte ✅. Ensuite ça tourne tout seul.

### 4. Ajouter les calendriers sur l'iPhone
Sur la page de configuration, **scanne un QR code avec l'appareil photo de l'iPhone**, touche la bannière qui
apparaît, puis **S'abonner**.

Deux façons de faire :
- **Avec les couleurs (recommandé)** : scanne **chaque matière**, plus « Retenues ».
  Chaque matière est un calendrier séparé, et tu choisis sa couleur dans l'app Calendrier › *Calendriers* › (i).
- **Rapide** : scanne seulement « Tout l'emploi du temps ». Tout tient dans un seul calendrier, et la couleur de
  la matière apparaît sous forme de carré 🟦🟧🟩 au début du titre.

Si le QR code ne marche pas : clique **Copier le lien**, envoie-le toi (mail, AirDrop…), puis sur l'iPhone :
**Réglages › Calendrier › Comptes › Ajouter un compte › Autre › Ajouter un calendrier avec abonnement** › colle le lien
› *Suivant* › *Enregistrer*. Les liens sont aussi dans `mes-secrets.txt`.

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
  1. Mets `mes-secrets.json` dans le dossier du projet (s'il n'y est pas déjà).
  2. Lance `npm run setup`. La page reprend automatiquement le même Gist et le même token.
     *(Sans `mes-secrets.json` : à l'étape ②, ouvre « Tu refais la connexion ? » et colle ton `GIST_ID`.)*
  3. Refais la connexion par QR code, puis mets à jour le secret **`CLE_ETAT`** dans GitHub
     (et `GIST_TOKEN` si tu as changé de token).
- **Un cours n'apparaît pas** : lance la synchro à la main (Actions › Run workflow) et regarde le journal.
  Il liste les matières trouvées.
- **Vérifier le format sans Pronote** : `npm test` génère un faux emploi du temps dans `sortie/`.

## Sécurité
- Le dépôt doit rester **privé**.
- Ne partage jamais `mes-secrets.txt` ou `mes-secrets.json`, ni le lien d'un calendrier, à quelqu'un dont tu ne veux pas qu'il voie ton emploi du temps.
- Le token GitHub n'a que le droit « gist » : il ne peut rien faire d'autre sur ton compte.

## Licence
© 2026 Sc4ros. Tous droits réservés. Voir le fichier [LICENSE](LICENSE).

Composants tiers : ils ne sont pas inclus dans ce dépôt (npm les installe) et gardent leur propre licence :
- [pawnote](https://www.npmjs.com/package/pawnote) : GPL-3.0-or-later
- [jsqr](https://www.npmjs.com/package/jsqr) : Apache-2.0
- [qrcode](https://www.npmjs.com/package/qrcode) : MIT

Projet non officiel, sans lien avec Index Éducation (éditeur de PRONOTE).
