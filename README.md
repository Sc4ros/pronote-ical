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

## 📱 Le plus simple : tout depuis le téléphone

👉 **https://pronote-ical.vercel.app** : ouvre ce site sur ton iPhone et suis les 4 étapes, **aucun PC, aucune installation**.

1. **Ta copie du projet** : un bouton crée ton dépôt GitHub privé à partir de ce modèle.
2. **Clé d'accès GitHub** : un formulaire pré-rempli (droits *Actions*, *Secrets* et *Gists*, limités à ta copie).
3. **Connexion à Pronote** : une capture d'écran du QR code de Pronote et ton code à 4 chiffres.
   La page crée le Gist secret, enregistre les 3 secrets et lance la première synchro toute seule.
4. **Abonnement** : un bouton « S'abonner » par calendrier.

> Comment ça marche sans PC ? Un navigateur ne peut pas parler directement à Pronote. La page dépose donc
> le QR code et le code **chiffrés** (AES-256) dans ton Gist secret, puis lance GitHub Actions, et c'est GitHub qui
> fait la première connexion à Pronote. Le QR code est remplacé par le jeton Pronote dès la connexion faite.
> La page tourne entièrement dans le navigateur : elle ne parle qu'à `api.github.com`.

L'installation sur PC ci-dessous (`npm run setup`) marche toujours, si tu préfères.

### Déjà installé avec la v1 ?

Rien ne t'oblige à changer : ton installation continue de marcher. Pour passer à la configuration depuis le
téléphone (et pouvoir reconnecter Pronote sans PC) :

1. Crée une nouvelle copie avec **Use this template**, puis suis le site de configuration.
   Le site **retrouve ton Gist existant** : tes abonnements sur l'iPhone restent valables, rien à refaire.
2. Supprime ensuite ton ancienne copie (ou désactive sa synchro dans **Actions**) : sa clé `CLE_ETAT`
   ne correspond plus au Gist, ses synchros échoueraient.

### Mettre le site en ligne (pour la personne qui héberge le site)

Le site est 100 % statique (dossier `site/`), sans serveur ni base de données : il ne stocke rien.

1. Sur GitHub, dans ce dépôt : **Settings** › coche **Template repository** (indispensable pour le bouton de l'étape 1).
   Le dépôt doit être **public** pour que d'autres puissent le copier.
2. Sur [vercel.com](https://vercel.com) : **Add New… › Project** › importe ce dépôt › **Deploy**.
   Tout est déjà réglé dans `vercel.json` (dossier `site/`, pas de compilation, en-têtes de sécurité).
3. Si le dépôt n'est pas `Sc4ros/pronote-ical`, change la constante `SOURCE` en haut de `site/configurer.js`.

Après une modification de `src/web/outils.js`, recompile avec `npm run build:mobile` (le fichier `site/outils.js` est commité).

---

## Installation sur PC (≈ 15 min, une seule fois)

### 0. Ce qu'il te faut
- Un compte **GitHub** (gratuit) : https://github.com/signup
- **Node.js 20 ou plus** sur ton PC : https://nodejs.org (bouton « LTS »)

### 1. Créer ta copie du projet sur GitHub (en **privé**)
1. Ouvre https://github.com/Sc4ros/pronote-ical/generate (bouton **Use this template**).
2. Nom `pronote-ical`, coche **Private**, puis **Create repository**.
3. Vérifie : l'onglet **Actions** de ta copie affiche « Synchro Pronote → iPhone » à gauche.
   **Ne le lance pas encore** : il faut d'abord faire les étapes 2 et 3 ci-dessous.

Le fichier qui lance la synchro (`.github/workflows/sync.yml`) est déjà dans le modèle : rien à créer à la main.
Pour la suite, télécharge aussi le projet sur ton PC (**Code** › **Download ZIP**, puis décompresse-le).


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

---

## Mettre en pause ou tout arrêter

### ⏸ Mettre en pause (par exemple pendant les vacances)
Dans ton dépôt : **Actions** › **Synchro Pronote → iPhone** › bouton **⋯** en haut à droite › **Disable workflow**.
Le robot ne tourne plus et le calendrier de l'iPhone reste figé tel quel.
Pour relancer : même endroit › **Enable workflow**.

### ⏹ Tout arrêter et tout supprimer
Fais les étapes dans cet ordre :

1. **Arrêter le robot** : supprime le dépôt GitHub : **Settings** › tout en bas, **Delete this repository**.
   *(Si tu veux garder le code, fais seulement **Disable workflow** comme ci-dessus.)*
2. **Supprimer les calendriers en ligne** : ouvre https://gist.github.com, clique sur le Gist
   « Emploi du temps Pronote (calendriers iPhone) » › **Delete**. Les liens des calendriers ne marchent plus
   et la clé de connexion Pronote (chiffrée) est effacée.
3. **Révoquer le token GitHub** : https://github.com/settings/tokens › ligne `pronote-ical` › **Delete**.
4. **Retirer les calendriers de l'iPhone** : **Réglages** › **Calendrier** › **Comptes** › touche chaque
   « Calendrier avec abonnement » › **Supprimer le compte**.
5. **Couper l'accès côté Pronote** : le script est vu par Pronote comme une « appli mobile ». S'il y a, dans ton
   espace Pronote, une rubrique qui liste les appareils ou applis mobiles connectés, supprime celui-là. Sinon,
   **changer ton mot de passe** (ENT/Pronote) invalide aussi la connexion. Après l'étape 2, plus rien ne peut s'en
   servir de toute façon.
6. **Nettoyer ton PC** : supprime le dossier du projet, en particulier `mes-secrets.txt` et `mes-secrets.json`.

Après ça, il ne reste plus rien : ni robot, ni fichier en ligne, ni accès à ton Pronote.

## Licence
© 2026 Sc4ros. Tous droits réservés. Voir le fichier [LICENSE](LICENSE).

Composants tiers : ils ne sont pas inclus dans ce dépôt (npm les installe) et gardent leur propre licence :
- [@blockshub/pawnote-lts](https://github.com/BlocksHub/Pawnote-LTS) : GPL-3.0-or-later. Fork maintenu de [pawnote](https://github.com/LiterateInk/Pawnote), compatible avec Pronote 2026.
- [jsqr](https://www.npmjs.com/package/jsqr) : Apache-2.0
- [qrcode](https://www.npmjs.com/package/qrcode) : MIT

Projet non officiel, sans lien avec Index Éducation (éditeur de PRONOTE).
