// À lancer UNE fois sur ton PC : « npm run setup »
// Se connecte à Pronote avec le QR code (marche avec n'importe quel ENT),
// crée le Gist secret qui contiendra les calendriers, et affiche les secrets
// à copier dans GitHub + les liens à mettre dans l'iPhone.

import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import {
  FICHIER_ETAT, chiffrer, creerGist, etatDepuis, lireGist, nouvelleCle, pronote, publier,
  recupererCalendriers, urlBrute,
} from "./coeur.js";

const rl = createInterface({ input: process.stdin, output: process.stdout });
const demander = async (q) => (await rl.question(q)).trim().replace(/^["']|["']$/g, "");

console.log(`
=====================================================
  Pronote → Calendrier iPhone : configuration
=====================================================

1. Ouvre Pronote sur ton ordinateur (en passant par ton ENT comme d'habitude).
2. Clique sur l'icône de téléphone / QR code en haut à droite
   (« Accéder à l'application mobile » / « Se connecter avec un QR code »).
3. Choisis un code à 4 chiffres, puis fais une CAPTURE D'ÉCRAN du QR code
   et enregistre-la (PNG ou JPG).
   ⏱  Le QR code n'est valable que quelques minutes : enchaîne vite.
`);

/* ------------------------------ QR code ----------------------------------- */

async function lireQr(entree) {
  if (entree.startsWith("{")) return JSON.parse(entree);
  if (!existsSync(entree)) throw new Error(`Fichier introuvable : ${entree}`);
  const { Jimp } = await import("jimp");
  const { default: jsQR } = await import("jsqr");
  const image = await Jimp.read(entree);
  const { data, width, height } = image.bitmap;
  const code = jsQR(new Uint8ClampedArray(data), width, height);
  if (!code) throw new Error("Aucun QR code lisible dans cette image (recadre la capture sur le QR code).");
  return JSON.parse(code.data);
}

const qr = await lireQr(
  await demander("Glisse ici la capture du QR code (ou colle son contenu JSON) puis Entrée :\n> "),
);
const pin = await demander("Le code à 4 chiffres que tu as choisi : ");

const deviceUUID = randomUUID();
const session = pronote.createSessionHandle();
let refresh;
try {
  refresh = await pronote.loginQrCode(session, { deviceUUID, pin, qr });
} catch (e) {
  console.error("\n❌ Connexion refusée. Le QR code a peut-être expiré ou le code est faux : recommence.");
  throw e;
}
const etat = etatDepuis(refresh, deviceUUID);
console.log(`\n✅ Connecté à Pronote : ${session.user?.name ?? refresh.username}\n`);

/* ------------------------------ GitHub ------------------------------------ */

console.log(`Il faut maintenant un « token » GitHub qui a SEULEMENT le droit « gist » :
  https://github.com/settings/tokens/new?scopes=gist&description=pronote-ical
  (Expiration : « No expiration » ou 1 an, puis « Generate token » et copie-le.)
`);
const jetonGithub = await demander("Colle le token GitHub (ghp_…) : ");

const cleEtat = nouvelleCle();
console.log("\n⏳ Récupération de l'emploi du temps…");
const { fichiers, matieres } = await recupererCalendriers(session);

let gistId = process.env.GIST_ID;
let proprietaire;
if (gistId) {
  // Reconfiguration : on réutilise le Gist existant → les abonnements iPhone restent valables.
  const g = await lireGist(gistId, jetonGithub);
  proprietaire = g.owner.login;
  await publier(gistId, jetonGithub, { ...fichiers, [FICHIER_ETAT]: chiffrer(etat, cleEtat) }, Object.keys(g.files));
} else {
  const g = await creerGist({ ...fichiers, [FICHIER_ETAT]: chiffrer(etat, cleEtat) }, jetonGithub);
  gistId = g.id;
  proprietaire = g.owner.login;
}

/* ----------------------------- récapitulatif ------------------------------ */

const secrets = { GIST_ID: gistId, GIST_TOKEN: jetonGithub, CLE_ETAT: cleEtat };
const liens = [
  ["TOUT (un seul calendrier, couleur en emoji)", "emploi-du-temps.ics"],
  ...matieres.map((m) => [m.nom, m.fichier]),
].map(([nom, f]) => `  • ${nom}\n    ${urlBrute(proprietaire, gistId, f)}`);

const recap = `
================ SECRETS GITHUB (à garder pour toi) ================
Dans ton dépôt GitHub › Settings › Secrets and variables › Actions
› « New repository secret », crée ces 3 secrets :

${Object.entries(secrets).map(([k, v]) => `  ${k} = ${v}`).join("\n")}

================ LIENS À AJOUTER SUR L'IPHONE ================
Réglages › Calendrier › Comptes › Ajouter un compte › Autre
› « Ajouter un calendrier avec abonnement », colle un lien :

${liens.join("\n")}
`;
console.log(recap);
writeFileSync("mes-secrets.txt", recap);
console.log("📄 Tout ça est aussi enregistré dans mes-secrets.txt (ce fichier n'est jamais envoyé sur GitHub).");

// Bonus : si l'outil « gh » est installé et que ce dossier est un dépôt GitHub, on règle les secrets tout seul.
try {
  execFileSync("gh", ["repo", "view", "--json", "name"], { stdio: "ignore" });
  const ok = await demander("\nL'outil gh est détecté : enregistrer les 3 secrets dans ton dépôt automatiquement ? (o/n) ");
  if (/^o/i.test(ok)) {
    for (const [k, v] of Object.entries(secrets)) execFileSync("gh", ["secret", "set", k, "--body", v], { stdio: "inherit" });
    console.log("✅ Secrets enregistrés.");
  }
} catch {
  /* pas de gh ou pas de dépôt : on fait à la main */
}

rl.close();
