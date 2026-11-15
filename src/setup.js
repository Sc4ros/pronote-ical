// À lancer UNE fois sur ton PC : « npm run setup »
// Ouvre une page dans ton navigateur (uniquement sur ton PC, rien n'est en ligne) pour :
//   1. se connecter à Pronote avec le QR code (on le colle ou on le glisse)
//   2. créer le Gist secret qui contiendra les calendriers
//   3. afficher les secrets GitHub et les QR codes à scanner avec l'iPhone

import { execFile, execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";
import {
  FICHIER_ETAT, chiffrer, creerFetcher, creerGist, diagnostic, etatDepuis, lireGist, nouvelleCle, pronote, publier,
  recupererCalendriers, urlBrute,
} from "./coeur.js";

const ici = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const PAGE = readFileSync(join(ici, "ui", "setup.html"), "utf8");
const JSQR = readFileSync(require.resolve("jsqr/dist/jsQR.js"), "utf8");
const FICHIER_JSON = "mes-secrets.json";
const FICHIER_TXT = "mes-secrets.txt";

// Jeton anti-intrusion : seule la page ouverte par ce script peut appeler l'API.
const jetonPage = randomBytes(16).toString("hex");

/* ------------------------------ état en mémoire ---------------------------- */

let connexion = null; // { session, etat }

const ancienneConfig = (() => {
  try {
    return JSON.parse(readFileSync(FICHIER_JSON, "utf8"));
  } catch {
    return null;
  }
})();

const ghDisponible = (() => {
  try {
    execFileSync("gh", ["repo", "view", "--json", "name"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

/* ---------------------------------- API ----------------------------------- */

const api = {
  async infos() {
    return {
      gistIdExistant: ancienneConfig?.GIST_ID ?? "",
      tokenExistant: !!ancienneConfig?.GIST_TOKEN,
      ghDisponible,
    };
  },

  async connexion({ qr, pin }) {
    if (!qr?.url || !qr?.jeton) throw new Error("Ce QR code ne vient pas de Pronote (appli mobile).");
    if (!/^\d{4}$/.test(String(pin ?? ""))) throw new Error("Le code doit faire exactement 4 chiffres.");
    if (DEMO) return demo.connexion();
    const deviceUUID = randomUUID();
    const { fetcher, journal } = creerFetcher();
    const session = pronote.createSessionHandle(fetcher);
    let refresh;
    try {
      refresh = await pronote.loginQrCode(session, { deviceUUID, pin: String(pin), qr });
    } catch (e) {
      const diag = diagnostic(journal);
      console.error(e);
      console.error("\n--- Diagnostic ---\n" + diag + "\n");
      if (e?.name === "PageUnavailableError") {
        const err = new Error(
          "Le serveur Pronote n'a pas renvoyé la page de connexion de l'appli mobile. Envoie le diagnostic ci-dessous à la personne qui t'aide.",
        );
        err.diagnostic = diag;
        throw err;
      }
      const err = new Error(
        "Pronote a refusé la connexion. Le QR code a sans doute expiré ou le code est faux : génère un nouveau QR code dans Pronote et recommence.",
      );
      err.diagnostic = `${e?.name ?? "Erreur"} : ${e?.message ?? e}`;
      throw err;
    }
    connexion = { session, etat: etatDepuis(refresh, deviceUUID) };
    return { nom: session.user?.name ?? refresh.username };
  },

  async creer({ githubToken, gistId }) {
    if (DEMO) return demo.creer();
    if (!connexion) throw new Error("Connecte-toi d'abord à Pronote (étape 1).");
    const jeton = (githubToken || ancienneConfig?.GIST_TOKEN || "").trim();
    if (!jeton) throw new Error("Il manque le token GitHub.");

    const { session, etat } = connexion;
    const cleEtat = nouvelleCle();
    const { fichiers, matieres } = await recupererCalendriers(session);
    const tout = { ...fichiers, [FICHIER_ETAT]: chiffrer(etat, cleEtat) };

    let id = (gistId || "").trim();
    let proprietaire;
    try {
      if (id) {
        // Reconnexion : même Gist → les abonnements iPhone restent valables.
        const g = await lireGist(id, jeton);
        proprietaire = g.owner.login;
        await publier(id, jeton, tout, Object.keys(g.files));
      } else {
        const g = await creerGist(tout, jeton);
        id = g.id;
        proprietaire = g.owner.login;
      }
    } catch (e) {
      console.error(e);
      if (/401|403/.test(e.message)) throw new Error("GitHub refuse ce token. Vérifie qu'il a bien la case « gist » cochée.");
      if (/404/.test(e.message)) throw new Error("Gist introuvable : vérifie l'identifiant, ou laisse la case vide pour en créer un nouveau.");
      throw e;
    }

    const secrets = { GIST_ID: id, GIST_TOKEN: jeton, CLE_ETAT: cleEtat };
    const calendriers = await Promise.all(
      [{ nom: "Tout l'emploi du temps", fichier: "emploi-du-temps.ics", tout: true }, ...matieres].map(async (m) => {
        const https = urlBrute(proprietaire, id, m.fichier);
        const webcal = https.replace(/^https:/, "webcal:");
        return { ...m, https, webcal, qr: await QRCode.toString(webcal, { type: "svg", margin: 1 }) };
      }),
    );

    writeFileSync(FICHIER_JSON, JSON.stringify(secrets, null, 2));
    writeFileSync(
      FICHIER_TXT,
      [
        "SECRETS GITHUB (Settings › Secrets and variables › Actions)",
        ...Object.entries(secrets).map(([k, v]) => `  ${k} = ${v}`),
        "",
        "LIENS DES CALENDRIERS (iPhone › Réglages › Calendrier › Comptes › Ajouter un compte › Autre › Ajouter un calendrier avec abonnement)",
        ...calendriers.map((c) => `  ${c.nom}\n    ${c.https}`),
        "",
      ].join("\n"),
    );

    return { secrets, calendriers };
  },

  async secretsGh({ secrets }) {
    if (!ghDisponible) throw new Error("L'outil gh n'est pas disponible.");
    for (const [k, v] of Object.entries(secrets)) {
      execFileSync("gh", ["secret", "set", k, "--body", v], { stdio: "ignore" });
    }
    return { ok: true };
  },
};

/* ------------------- mode démo (DEMO=1) : sans Pronote ni GitHub ----------- */

const DEMO = !!process.env.DEMO;
const demo = {
  connexion: () => ({ nom: "ÉLÈVE Démo" }),
  async creer() {
    const base = "https://gist.githubusercontent.com/demo/0000/raw/";
    const liste = [
      { nom: "Tout l'emploi du temps", fichier: "emploi-du-temps.ics", tout: true },
      { nom: "MATHÉMATIQUES", fichier: "matiere-mathematiques.ics", couleur: "#2F6FDE" },
      { nom: "PHYSIQUE-CHIMIE", fichier: "matiere-physique-chimie.ics", couleur: "#FF9900" },
      { nom: "ANGLAIS LV1", fichier: "matiere-anglais-lv1.ics", couleur: "#2ECC71" },
      { nom: "Retenues", fichier: "retenues.ics", couleur: "#D32F2F" },
    ];
    return {
      secrets: { GIST_ID: "0123456789abcdef", GIST_TOKEN: "ghp_demoDEMOdemoDEMO", CLE_ETAT: "cle-de-demo" },
      calendriers: await Promise.all(
        liste.map(async (m) => {
          const https = base + m.fichier;
          const webcal = https.replace(/^https:/, "webcal:");
          return { ...m, https, webcal, qr: await QRCode.toString(webcal, { type: "svg", margin: 1 }) };
        }),
      ),
    };
  },
};

/* --------------------------------- serveur -------------------------------- */

const lireCorps = (req) =>
  new Promise((ok, ko) => {
    let d = "";
    req.on("data", (c) => {
      d += c;
      if (d.length > 1e6) ko(new Error("Requête trop grosse"));
    });
    req.on("end", () => ok(d ? JSON.parse(d) : {}));
  });

const serveur = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      return res.end(PAGE.replace("__JETON__", jetonPage));
    }
    if (req.method === "GET" && url.pathname === "/jsqr.js") {
      res.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8" });
      return res.end(JSQR);
    }
    const nom = url.pathname.replace(/^\/api\//, "");
    if (req.method === "POST" && url.pathname.startsWith("/api/") && api[nom]) {
      if (req.headers["x-jeton"] !== jetonPage) {
        res.writeHead(403);
        return res.end();
      }
      const resultat = await api[nom](await lireCorps(req));
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(resultat));
    }
    res.writeHead(404);
    res.end();
  } catch (e) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ erreur: e.message, diagnostic: e.diagnostic }));
  }
});

function ouvrirNavigateur(adresse) {
  const [cmd, args] =
    process.platform === "win32" ? ["cmd", ["/c", "start", "", adresse]]
    : process.platform === "darwin" ? ["open", [adresse]]
    : ["xdg-open", [adresse]];
  execFile(cmd, args, () => {});
}

serveur.listen(Number(process.env.PORT ?? 0), "127.0.0.1", () => {
  const adresse = `http://localhost:${serveur.address().port}/`;
  console.log(`
=====================================================
  Pronote → Calendrier iPhone : configuration
=====================================================

  La page de configuration s'ouvre dans ton navigateur.
  Si rien ne s'ouvre, copie cette adresse dans ton navigateur :

      ${adresse}

  Laisse cette fenêtre ouverte pendant la configuration.
  Quand tu as fini, ferme-la (ou Ctrl + C).
`);
  if (existsSync(FICHIER_JSON)) console.log(`  (${FICHIER_JSON} trouvé : le même Gist sera réutilisé.)\n`);
  if (!process.env.PAS_DE_NAVIGATEUR) ouvrirNavigateur(adresse);
});
