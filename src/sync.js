// Lancé par GitHub Actions toutes les heures :
// 1. lit le jeton Pronote (chiffré) dans le Gist
// 2. se reconnecte à Pronote et SAUVEGARDE tout de suite le nouveau jeton
// 3. récupère l'emploi du temps et met à jour les .ics du Gist

import {
  FICHIER_ETAT, chiffrer, connexionJeton, dechiffrer, lireGist, publier, recupererCalendriers,
} from "./coeur.js";

const { GIST_ID, GIST_TOKEN, CLE_ETAT } = process.env;
for (const [nom, valeur] of Object.entries({ GIST_ID, GIST_TOKEN, CLE_ETAT })) {
  if (!valeur) {
    console.error(`❌ Secret manquant : ${nom} (GitHub › Settings › Secrets and variables › Actions)`);
    process.exit(1);
  }
}

const gist = await lireGist(GIST_ID, GIST_TOKEN);
const contenuEtat = gist.files[FICHIER_ETAT]?.content;
if (!contenuEtat) throw new Error(`Le fichier ${FICHIER_ETAT} est absent du Gist : relance « npm run setup ».`);

let etat;
try {
  etat = dechiffrer(contenuEtat, CLE_ETAT);
} catch {
  throw new Error("Impossible de déchiffrer l'état : le secret CLE_ETAT ne correspond pas au Gist.");
}

let session;
try {
  ({ session, etat } = await connexionJeton(etat));
} catch (e) {
  console.error("❌ Connexion à Pronote refusée avec le jeton enregistré.");
  console.error("   → Refais la connexion par QR code : « npm run setup » sur ton PC (voir README).");
  throw e;
}

// Le jeton a changé : on le sauvegarde AVANT toute autre chose.
const fichiersExistants = Object.keys(gist.files);
await publier(GIST_ID, GIST_TOKEN, { [FICHIER_ETAT]: chiffrer(etat, CLE_ETAT) });
console.log(`✅ Connecté à Pronote : ${session.user?.name ?? "?"}`);

const { fichiers, matieres } = await recupererCalendriers(session);
await publier(GIST_ID, GIST_TOKEN, fichiers, fichiersExistants);

const nb = (fichiers["emploi-du-temps.ics"].match(/BEGIN:VEVENT/g) ?? []).length;
console.log(`✅ ${nb} événements publiés, ${matieres.length} calendriers par matière :`);
for (const m of matieres) console.log(`   • ${m.nom} → ${m.fichier}`);
