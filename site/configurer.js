// Assistant de configuration (tourne entièrement dans le navigateur).
import { jsQR, chiffrer, sceller, nouvelleCle } from "/outils.js";

const $ = (id) => document.getElementById(id);
const FICHIER_ETAT = "etat-connexion.chiffre";
const WORKFLOW = "sync.yml";
const DESCRIPTION_GIST = "Emploi du temps Pronote (calendriers iPhone)";

// Dépôt modèle à copier (doit être public et coché « Template repository »).
const SOURCE = "Sc4ros/pronote-ical";
$("lienModele").href = `https://github.com/${SOURCE}/generate`;
$("lienToken").href = "https://github.com/settings/personal-access-tokens/new?" + new URLSearchParams({
  name: "pronote-ical", description: "Synchro Pronote vers le calendrier iPhone", expires_in: "none",
  actions: "write", secrets: "write", gists: "write",
});

/* ------------------------------ mémoire locale ----------------------------- */
// iOS recharge souvent l'onglet quand on part faire la capture d'écran : on garde
// la clé le temps de l'onglet (sessionStorage), et le nom du dépôt plus longtemps.
const memoire = {
  lire(k, local = false) { try { return (local ? localStorage : sessionStorage).getItem(k) ?? ""; } catch { return ""; } },
  ecrire(k, v, local = false) { try { (local ? localStorage : sessionStorage).setItem(k, v); } catch {} },
};
$("token").value = memoire.lire("token");
$("depot").value = memoire.lire("depot", true) || "pronote-ical";

/* ----------------------------------- UI ------------------------------------ */

function statut(el, texte, type = "", chargement = false) {
  el.className = "statut " + type;
  el.textContent = texte;
  if (chargement) el.prepend(Object.assign(document.createElement("span"), { className: "spin" }));
}
function ligne(texte, type = "", chargement = false) {
  const li = document.createElement("li");
  statut(li, texte, type, chargement);
  li.className = type;
  $("journal").append(li);
  li.scrollIntoView({ block: "nearest", behavior: "smooth" });
  return {
    fini: (t = texte) => { statut(li, "✓ " + t); li.className = "ok"; },
    rate: (t) => { statut(li, "✗ " + t); li.className = "erreur"; },
    maj: (t) => { statut(li, t, "", true); li.className = ""; },
  };
}
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/* --------------------------------- GitHub ---------------------------------- */

let ctx = null; // { token, login, depot, branche }

async function gh(chemin, { method = "GET", corps } = {}) {
  const r = await fetch("https://api.github.com" + chemin, {
    method, cache: "no-store",
    headers: {
      Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28",
      Authorization: `Bearer ${ctx.token}`, ...(corps ? { "Content-Type": "application/json" } : {}),
    },
    body: corps ? JSON.stringify(corps) : undefined,
  });
  if (!r.ok) {
    const e = new Error(`GitHub ${method} ${chemin.split("?")[0]} → ${r.status}`);
    e.status = r.status;
    e.details = await r.text().catch(() => "");
    throw e;
  }
  const texte = await r.text(); // 201/204 sans contenu (secrets, lancement de synchro)
  return texte ? JSON.parse(texte) : null;
}
const depot = () => `/repos/${ctx.login}/${ctx.depot}`;

async function verifier() {
  const token = $("token").value.trim();
  const nomDepot = $("depot").value.trim().replace(/^.*github\.com\//, "").split("/").pop();
  if (!token) throw new Error("Colle d'abord ta clé GitHub.");
  if (!nomDepot) throw new Error("Indique le nom de ta copie.");
  ctx = { token, depot: nomDepot };

  const moi = await gh("/user").catch((e) => {
    throw new Error(e.status === 401 ? "Clé GitHub invalide : vérifie que tu l'as bien copiée en entier." : e.message);
  });
  ctx.login = moi.login;

  const repo = await gh(depot()).catch((e) => {
    throw new Error(e.status === 404
      ? `Je ne trouve pas « ${ctx.login}/${ctx.depot} ». Vérifie le nom, et que la clé a bien accès à ce dépôt (Repository access).`
      : e.message);
  });
  ctx.branche = repo.default_branch;

  await gh(`${depot()}/actions/workflows/${WORKFLOW}`).catch((e) => {
    throw new Error(e.status === 404
      ? "Ce dépôt n'a pas le fichier .github/workflows/sync.yml : crée ta copie avec le bouton de l'étape 1."
      : e.status === 403 ? "La clé n'a pas le droit « Actions : Read and write »." : e.message);
  });
  await gh(`${depot()}/actions/secrets/public-key`).catch((e) => {
    throw new Error(e.status === 403 || e.status === 404 ? "La clé n'a pas le droit « Secrets : Read and write »." : e.message);
  });
  await gh("/gists?per_page=1").catch((e) => {
    throw new Error(e.status === 403 || e.status === 404 ? "La clé n'a pas le droit « Gists : Read and write »." : e.message);
  });

  memoire.ecrire("token", token);
  memoire.ecrire("depot", nomDepot, true);
  memoire.ecrire("login", ctx.login, true); // pour la page « Arrêter »
  return `${ctx.login}/${ctx.depot}`;
}

async function trouverOuCreerGist() {
  for (let page = 1; page <= 10; page++) {
    const liste = await gh(`/gists?per_page=100&page=${page}`);
    const g = liste.find((x) => x.files?.[FICHIER_ETAT]);
    if (g) return { id: g.id, nouveau: false };
    if (liste.length < 100) break;
  }
  const g = await gh("/gists", {
    method: "POST",
    corps: { description: DESCRIPTION_GIST, public: false, files: { [FICHIER_ETAT]: { content: "en attente" } } },
  });
  return { id: g.id, nouveau: true };
}

async function ecrireSecret(nom, valeur) {
  const { key, key_id } = await gh(`${depot()}/actions/secrets/public-key`);
  await gh(`${depot()}/actions/secrets/${nom}`, {
    method: "PUT", corps: { encrypted_value: sceller(valeur, key), key_id },
  });
}

/** Lance la synchro et attend qu'une synchro démarrée après maintenant se termine. */
async function lancerEtAttendre(suivi) {
  const runs = `${depot()}/actions/workflows/${WORKFLOW}/runs?per_page=10`;
  const avant = new Set((await gh(runs)).workflow_runs.map((r) => r.id));
  await gh(`${depot()}/actions/workflows/${WORKFLOW}/dispatches`, { method: "POST", corps: { ref: ctx.branche } });
  const debut = Date.now();
  while (Date.now() - debut < 8 * 60 * 1000) {
    await pause(4000);
    const nouveaux = (await gh(runs)).workflow_runs.filter((r) => !avant.has(r.id));
    const fini = nouveaux.find((r) => r.status === "completed" && r.conclusion !== "cancelled");
    if (fini) return fini;
    const enCours = nouveaux.find((r) => r.status === "in_progress");
    const s = Math.round((Date.now() - debut) / 1000);
    suivi.maj(enCours ? `Connexion à Pronote et création des calendriers… (${s} s)` : `GitHub démarre la synchro… (${s} s)`);
  }
  throw new Error("La synchro met trop de temps. Regarde l'onglet Actions de ta copie sur GitHub.");
}

/* --------------------------------- étape 2 --------------------------------- */

$("btnVerifier").addEventListener("click", async () => {
  $("btnVerifier").disabled = true;
  statut($("s2"), "Vérification…", "", true);
  try {
    const nom = await verifier();
    statut($("s2"), `Tout est bon : ${nom} ✓`, "ok");
    $("e1").classList.add("faite");
    $("e2").classList.add("faite");
    $("e3").classList.remove("inactive");
    $("e3").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (e) {
    statut($("s2"), e.message, "erreur");
  } finally {
    $("btnVerifier").disabled = false;
  }
});

/* --------------------------------- étape 3 --------------------------------- */

let qrPronote = null;

function lireImage(fichier) {
  return new Promise((ok, ko) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => ko(new Error("Impossible de lire cette image."));
    img.src = URL.createObjectURL(fichier);
  });
}

function decoder(img) {
  // Taille réelle, puis plus petit (plus rapide, et parfois plus fiable sur les captures).
  for (const echelle of [1, 0.6, 0.35]) {
    const w = Math.round(img.naturalWidth * echelle), h = Math.round(img.naturalHeight * echelle);
    if (w < 80) break;
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(img, 0, 0, w, h);
    const res = jsQR(g.getImageData(0, 0, w, h).data, w, h);
    if (res) return res.data;
  }
  return null;
}

$("zone").addEventListener("click", () => $("fichier").click());
$("fichier").addEventListener("change", async (e) => {
  const fichier = e.target.files[0];
  e.target.value = "";
  if (!fichier) return;
  $("apercu").style.display = "flex";
  $("miniature").src = URL.createObjectURL(fichier);
  statut($("qrStatut"), "Lecture du QR code…", "", true);
  qrPronote = null;
  try {
    const texte = decoder(await lireImage(fichier));
    let qr = null;
    try { qr = JSON.parse(texte); } catch {}
    if (!texte) statut($("qrStatut"), "Aucun QR code trouvé. Recadre la capture sur le QR code et réessaie.", "erreur");
    else if (!qr?.url || !qr?.jeton) statut($("qrStatut"), "Ce QR code ne vient pas de Pronote (choisis celui pour l'appli mobile).", "erreur");
    else { qrPronote = qr; statut($("qrStatut"), "QR code Pronote détecté ✓", "ok"); $("pin").focus(); }
  } catch (err) {
    statut($("qrStatut"), err.message, "erreur");
  }
  majBouton();
});

const pinValide = () => /^\d{4}$/.test($("pin").value);
function majBouton() { $("btnLancer").disabled = !(qrPronote && pinValide() && ctx); }
$("pin").addEventListener("input", () => { $("pin").value = $("pin").value.replace(/\D/g, "").slice(0, 4); majBouton(); });

$("btnLancer").addEventListener("click", async () => {
  $("btnLancer").disabled = true;
  $("journal").replaceChildren();
  let suivi;
  try {
    suivi = ligne("Préparation du Gist secret…", "", true);
    const gist = await trouverOuCreerGist();
    suivi.fini(gist.nouveau ? "Gist secret créé" : "Gist existant réutilisé (tes abonnements restent valables)");

    suivi = ligne("Chiffrement de la connexion Pronote…", "", true);
    const cle = nouvelleCle();
    const etat = { qr: qrPronote, pin: $("pin").value, deviceUUID: crypto.randomUUID() };
    await gh(`/gists/${gist.id}`, { method: "PATCH", corps: { files: { [FICHIER_ETAT]: { content: await chiffrer(etat, cle) } } } });
    suivi.fini("Connexion Pronote chiffrée dans le Gist");

    suivi = ligne("Enregistrement des secrets GitHub…", "", true);
    await ecrireSecret("GIST_ID", gist.id);
    await ecrireSecret("GIST_TOKEN", ctx.token);
    await ecrireSecret("CLE_ETAT", cle);
    suivi.fini("Secrets GIST_ID, GIST_TOKEN et CLE_ETAT enregistrés");

    suivi = ligne("Lancement de la synchro…", "", true);
    const run = await lancerEtAttendre(suivi);
    if (run.conclusion !== "success") {
      suivi.rate("La synchro a échoué.");
      const li = ligne("");
      li.rate("");
      li_html(li, run.html_url);
      throw null;
    }
    suivi.fini("Pronote connecté, emploi du temps publié");

    await afficherCalendriers(gist.id);
    $("e3").classList.add("faite");
    $("e4").classList.remove("inactive");
    $("e4").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (e) {
    if (e) (suivi ?? ligne("")).rate(e.message + (e.details ? ` (${e.details.slice(0, 160)})` : ""));
    qrPronote = null;
    statut($("qrStatut"), "Génère un nouveau QR code dans Pronote avant de réessayer.", "erreur");
    majBouton();
  }
});

function li_html(_, url) {
  const li = $("journal").lastElementChild;
  li.className = "erreur";
  li.innerHTML = "Le plus souvent : QR code expiré ou code à 4 chiffres faux. Refais une capture avec un "
    + "<b>nouveau</b> QR code et relance. ";
  const a = Object.assign(document.createElement("a"), { href: url, target: "_blank", rel: "noopener", textContent: "Voir le détail sur GitHub ↗" });
  li.append(a);
}

/* --------------------------------- étape 4 --------------------------------- */

async function afficherCalendriers(id) {
  const g = await gh(`/gists/${id}`);
  const proprio = g.owner.login;
  const liste = Object.values(g.files)
    .filter((f) => f.filename.endsWith(".ics"))
    .map((f) => ({
      fichier: f.filename,
      nom: f.filename === "emploi-du-temps.ics" ? "Tout l'emploi du temps" : (f.content.match(/^X-WR-CALNAME:(.*)$/m)?.[1] ?? f.filename).replace(/\\,/g, ",").replace(/\\;/g, ";").trim(),
      couleur: f.content.match(/^X-APPLE-CALENDAR-COLOR:(#[0-9A-F]{6})/im)?.[1],
      vide: !f.content.includes("BEGIN:VEVENT"),
    }))
    .filter((c) => !c.vide || c.fichier === "emploi-du-temps.ics")
    .sort((a, b) => (b.fichier === "emploi-du-temps.ics") - (a.fichier === "emploi-du-temps.ics") || a.nom.localeCompare(b.nom, "fr"));

  $("calendriers").replaceChildren(...liste.map((c) => {
    const https = `https://gist.githubusercontent.com/${proprio}/${id}/raw/${c.fichier}`;
    const div = document.createElement("div");
    div.className = "cal" + (c.fichier === "emploi-du-temps.ics" ? " tout" : "");
    const pastille = Object.assign(document.createElement("span"), { className: "pastille" });
    if (c.couleur) pastille.style.background = c.couleur;
    const nom = Object.assign(document.createElement("span"), { className: "nom", textContent: c.nom });
    const copier = Object.assign(document.createElement("button"), { className: "copier", textContent: "Copier" });
    copier.onclick = async () => {
      try { await navigator.clipboard.writeText(https); copier.textContent = "Copié ✓"; } catch { prompt("Lien :", https); }
    };
    const lien = Object.assign(document.createElement("a"), { href: https.replace(/^https:/, "webcal:"), textContent: "S'abonner" });
    div.append(pastille, nom, copier, lien);
    return div;
  }));
}

// Reprise après rechargement de l'onglet (iOS) : on revérifie la clé en silence.
if ($("token").value) $("btnVerifier").click();
