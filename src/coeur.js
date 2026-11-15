// Logique partagée entre setup.js (une seule fois, sur ton PC) et sync.js (GitHub, toutes les heures).

process.env.TZ = "Europe/Paris"; // Pronote donne les heures en heure de Paris

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import * as pronote from "pawnote";
import { construireCalendriers, calendrierVide } from "./ics.js";

export const FICHIER_ETAT = "etat-connexion.chiffre";

/* --------------------------- options (variables) --------------------------- */

export const options = {
  semainesAvant: Number(process.env.SEMAINES_AVANT ?? 1),
  semainesApres: Number(process.env.SEMAINES_APRES ?? 8),
  // "non" → les cours annulés (prof absent…) disparaissent complètement du calendrier
  afficherAnnules: !/^(non|no|false|0)$/i.test(process.env.AFFICHER_ANNULES ?? "oui"),
};

/* ------------------- chiffrement de l'état de connexion ------------------- */
// Pronote donne un nouveau « jeton » à chaque connexion : il faut le sauvegarder
// à chaque fois. On le stocke chiffré (AES-256-GCM) dans le Gist secret.

const cle = (secret) => createHash("sha256").update(secret).digest();

export function chiffrer(objet, secret) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", cle(secret), iv);
  const donnees = Buffer.concat([c.update(JSON.stringify(objet), "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), donnees]).toString("base64");
}

export function dechiffrer(texte, secret) {
  const brut = Buffer.from(texte.trim(), "base64");
  const d = createDecipheriv("aes-256-gcm", cle(secret), brut.subarray(0, 12));
  d.setAuthTag(brut.subarray(12, 28));
  return JSON.parse(Buffer.concat([d.update(brut.subarray(28)), d.final()]).toString("utf8"));
}

export const nouvelleCle = () => randomBytes(32).toString("base64url");

/* ------------------------------- Pronote ---------------------------------- */

/** Transforme ce que renvoie pawnote en état à sauvegarder. */
export const etatDepuis = (refresh, deviceUUID) => ({
  url: refresh.url,
  username: refresh.username,
  token: refresh.token,
  kind: refresh.kind,
  navigatorIdentifier: refresh.navigatorIdentifier,
  deviceUUID,
});

/** Reconnexion avec le jeton sauvegardé. Renvoie la session et le NOUVEL état. */
export async function connexionJeton(etat) {
  const session = pronote.createSessionHandle();
  const refresh = await pronote.loginToken(session, {
    url: etat.url,
    kind: etat.kind,
    username: etat.username,
    token: etat.token,
    deviceUUID: etat.deviceUUID,
    navigatorIdentifier: etat.navigatorIdentifier,
  });
  return { session, etat: etatDepuis(refresh, etat.deviceUUID) };
}

const JOUR = 24 * 3600 * 1000;

function lundi(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

/** Récupère l'emploi du temps et construit tous les .ics. */
export async function recupererCalendriers(session) {
  const debut = new Date(lundi(new Date()).getTime() - options.semainesAvant * 7 * JOUR);
  let fin = new Date(lundi(new Date()).getTime() + (options.semainesApres + 1) * 7 * JOUR);
  const finAnnee = session.instance?.lastDate;
  if (finAnnee && fin > finAnnee) fin = new Date(finAnnee.getTime() + JOUR);
  if (fin <= debut) fin = new Date(debut.getTime() + 7 * JOUR); // vacances d'été

  const edt = await pronote.timetableFromIntervals(session, debut, fin);
  pronote.parseTimetable(session, edt, {
    withCanceledClasses: true, // on garde les cours annulés pour afficher « ❌ ANNULÉ »
    withSuperposedCanceledClasses: false, // sauf s'ils sont remplacés par un autre cours
    withPlannedClasses: true,
  });

  return construireCalendriers(edt.classes, {
    afficherAnnules: options.afficherAnnules,
    nomEleve: session.user?.name ?? "",
  });
}

/* --------------------------------- Gist ----------------------------------- */

const API = "https://api.github.com";

async function github(chemin, jetonGithub, init = {}) {
  const r = await fetch(API + chemin, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${jetonGithub}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "pronote-ical",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  if (!r.ok) throw new Error(`GitHub ${init.method ?? "GET"} ${chemin} → ${r.status} ${await r.text()}`);
  return r.json();
}

export const lireGist = (id, jeton) => github(`/gists/${id}`, jeton);

export const creerGist = (fichiers, jeton) =>
  github("/gists", jeton, {
    method: "POST",
    body: JSON.stringify({
      description: "Emploi du temps Pronote (calendriers iPhone)",
      public: false,
      files: Object.fromEntries(Object.entries(fichiers).map(([n, c]) => [n, { content: c }])),
    }),
  });

/** Met à jour le Gist. Les matières qui ont disparu sont vidées (pas supprimées,
 *  pour que l'abonnement iPhone ne casse pas). */
export async function publier(id, jeton, fichiers, fichiersExistants = []) {
  const tout = { ...fichiers };
  for (const nom of fichiersExistants) {
    if (nom.endsWith(".ics") && !(nom in tout)) tout[nom] = calendrierVide(nom.replace(/\.ics$/, ""));
  }
  let derniereErreur;
  for (let essai = 1; essai <= 3; essai++) {
    try {
      return await github(`/gists/${id}`, jeton, {
        method: "PATCH",
        body: JSON.stringify({
          files: Object.fromEntries(Object.entries(tout).map(([n, c]) => [n, { content: c }])),
        }),
      });
    } catch (e) {
      derniereErreur = e;
      await new Promise((r) => setTimeout(r, 2000 * essai));
    }
  }
  throw derniereErreur;
}

export const urlBrute = (proprietaire, id, fichier) =>
  `https://gist.githubusercontent.com/${proprietaire}/${id}/raw/${fichier}`;

export { pronote };
