// Transforme les cours Pronote en fichiers .ics (format iCalendar, RFC 5545).
// Aucune dépendance à Pronote ici : ce module est testable hors-ligne.

import { createHash } from "node:crypto";

export const NOM_FICHIER_TOUT = "emploi-du-temps.ics";
export const NOM_FICHIER_RETENUES = "retenues.ics";
export const NOM_FICHIER_ACTIVITES = "activites.ics";

/* ----------------------------- utilitaires ics ----------------------------- */

const echapper = (texte) =>
  String(texte)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");

// Les lignes .ics ne doivent pas dépasser 75 octets (UTF-8) : on les replie.
function plier(ligne) {
  const octets = Buffer.from(ligne, "utf8");
  if (octets.length <= 75) return ligne;
  const morceaux = [];
  let courant = "";
  let taille = 0;
  for (const caractere of ligne) {
    const t = Buffer.byteLength(caractere, "utf8");
    const limite = morceaux.length === 0 ? 75 : 74; // 74 + l'espace de continuation
    if (taille + t > limite) {
      morceaux.push(courant);
      courant = "";
      taille = 0;
    }
    courant += caractere;
    taille += t;
  }
  morceaux.push(courant);
  return morceaux.join("\r\n ");
}

const dateUTC = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export function slug(texte) {
  return (
    String(texte)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "autre"
  );
}

/* ------------------------------- couleurs --------------------------------- */

function hexVersHsl(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: h * 60, s, l };
}

/** Carré emoji le plus proche de la couleur Pronote (pour le calendrier unique). */
export function emojiCouleur(hex) {
  const c = hexVersHsl(hex);
  if (!c) return "";
  if (c.s < 0.15 || c.l > 0.92 || c.l < 0.08) return c.l > 0.6 ? "⬜" : "⬛";
  const { h, l } = c;
  if (h < 15 || h >= 345) return "🟥";
  if (h < 45) return l < 0.35 ? "🟫" : "🟧";
  if (h < 70) return "🟨";
  if (h < 170) return "🟩";
  if (h < 260) return "🟦";
  return "🟪";
}

/* ------------------------ cours Pronote → événements ----------------------- */

/**
 * Convertit un « class » Pronote (cours, retenue ou activité) en objet neutre.
 * @param {object} c  élément de timetable.classes (pawnote)
 */
export function versEvenement(c) {
  const lignes = [];
  let titre;
  let categorie;
  let couleur = c.backgroundColor;
  let lieu = [];
  let annule = false;

  if (c.is === "lesson") {
    categorie = c.subject?.name?.trim() || "Cours";
    titre = categorie;
    annule = !!c.canceled;
    lieu = c.classrooms ?? [];

    const prefixes = [];
    if (annule) prefixes.push("❌ ANNULÉ");
    else if (c.status) prefixes.push("⚠️");
    if (c.test) prefixes.push("📝 DS");
    if (prefixes.length) titre = `${prefixes.join(" ")} – ${titre}`;
    if (c.status) titre += ` (${c.status})`;
    if (c.exempted) titre += " (dispensé)";

    if (c.status) lignes.push(`Statut : ${c.status}`);
    if (c.teacherNames?.length) lignes.push(`Professeur : ${c.teacherNames.join(", ")}`);
    if (lieu.length) lignes.push(`Salle : ${lieu.join(", ")}`);
    if (c.groupNames?.length) lignes.push(`Groupe : ${c.groupNames.join(", ")}`);
    if (c.personalNames?.length) lignes.push(`Personnel : ${c.personalNames.join(", ")}`);
    if (c.test) lignes.push("📝 Devoir surveillé prévu");
    if (c.exempted) lignes.push("Tu es dispensé(e) de ce cours");
    for (const url of c.virtualClassrooms ?? []) lignes.push(`Classe virtuelle : ${url}`);
  } else if (c.is === "detention") {
    categorie = "Retenues";
    titre = `🚨 Retenue${c.title ? ` – ${c.title}` : ""}`;
    lieu = c.classrooms ?? [];
    if (c.teacherNames?.length) lignes.push(`Professeur : ${c.teacherNames.join(", ")}`);
    if (c.personalNames?.length) lignes.push(`Personnel : ${c.personalNames.join(", ")}`);
    if (lieu.length) lignes.push(`Salle : ${lieu.join(", ")}`);
    couleur = couleur || "#d32f2f";
  } else {
    categorie = "Activités";
    titre = c.title || "Activité";
    if (c.attendants?.length) lignes.push(`Participants : ${c.attendants.join(", ")}`);
    if (c.resourceTypeName) lignes.push(`${c.resourceTypeName} : ${c.resourceValue ?? ""}`);
  }

  if (c.notes) lignes.push("", `Mémo : ${c.notes}`);

  const debut = new Date(c.startDate);
  const fin = new Date(c.endDate);
  // Identifiant stable entre deux synchros (les id Pronote changent à chaque session).
  const uid =
    createHash("sha1")
      .update(`${c.is}|${debut.toISOString()}|${categorie}|${(c.groupNames ?? []).join(",")}`)
      .digest("hex")
      .slice(0, 24) + "@pronote-ical";

  return {
    uid,
    type: c.is,
    categorie,
    titre,
    debut,
    fin,
    lieu: lieu.join(", "),
    description: lignes.join("\n"),
    couleur,
    annule,
  };
}

/* ---------------------------- construction .ics ---------------------------- */

function calendrier({ nom, couleur, evenements, emoji = false }) {
  const maintenant = dateUTC(new Date());
  const out = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//pronote-ical//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${echapper(nom)}`,
    "X-WR-TIMEZONE:Europe/Paris",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];
  // Couleur proposée à l'abonnement (l'iPhone la reprend souvent, sinon tu la choisis toi-même).
  if (couleur) out.push(`X-APPLE-CALENDAR-COLOR:${couleur.toUpperCase()}`);

  for (const e of evenements) {
    const titre = emoji && e.couleur ? `${emojiCouleur(e.couleur)} ${e.titre}` : e.titre;
    out.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTAMP:${maintenant}`,
      `DTSTART:${dateUTC(e.debut)}`,
      `DTEND:${dateUTC(e.fin)}`,
      `SUMMARY:${echapper(titre)}`,
    );
    if (e.lieu) out.push(`LOCATION:${echapper(e.lieu)}`);
    if (e.description) out.push(`DESCRIPTION:${echapper(e.description)}`);
    out.push(`CATEGORIES:${echapper(e.categorie)}`);
    // Un cours annulé apparaît « disponible » et non « occupé ».
    // (Pas de STATUS:CANCELLED : certaines applis masquent alors l'événement,
    // alors qu'on veut voir « ❌ ANNULÉ » dans le titre.)
    out.push(e.annule ? "TRANSP:TRANSPARENT" : "TRANSP:OPAQUE");
    out.push("END:VEVENT");
  }
  out.push("END:VCALENDAR");
  return out.map(plier).join("\r\n") + "\r\n";
}

const couleurMajoritaire = (evts) => {
  const compte = new Map();
  for (const e of evts) if (e.couleur) compte.set(e.couleur, (compte.get(e.couleur) ?? 0) + 1);
  return [...compte.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
};

/**
 * Construit tous les fichiers .ics.
 * @returns {{ fichiers: Record<string,string>, matieres: {nom:string, fichier:string, couleur?:string}[] }}
 */
export function construireCalendriers(classes, { afficherAnnules = true, nomEleve = "" } = {}) {
  let evenements = classes.map(versEvenement);
  if (!afficherAnnules) evenements = evenements.filter((e) => !e.annule);
  evenements.sort((a, b) => a.debut - b.debut);

  const fichiers = {};
  const suffixe = nomEleve ? ` – ${nomEleve}` : "";
  fichiers[NOM_FICHIER_TOUT] = calendrier({
    nom: `Pronote${suffixe}`,
    evenements,
    emoji: true,
  });

  // Un calendrier par matière → une couleur par matière sur l'iPhone.
  const parCategorie = new Map();
  for (const e of evenements) {
    if (!parCategorie.has(e.categorie)) parCategorie.set(e.categorie, []);
    parCategorie.get(e.categorie).push(e);
  }
  const matieres = [];
  for (const [nom, evts] of [...parCategorie.entries()].sort((a, b) => a[0].localeCompare(b[0], "fr"))) {
    const fichier =
      nom === "Retenues" ? NOM_FICHIER_RETENUES : nom === "Activités" ? NOM_FICHIER_ACTIVITES : `matiere-${slug(nom)}.ics`;
    const couleur = couleurMajoritaire(evts);
    fichiers[fichier] = calendrier({ nom: `${nom} (Pronote)`, couleur, evenements: evts });
    matieres.push({ nom, fichier, couleur });
  }
  return { fichiers, matieres };
}

/** Calendrier vide (pour vider une matière qui n'apparaît plus). */
export const calendrierVide = (nom) => calendrier({ nom, evenements: [] });
