// Page « Arrêter » : construit les liens directs vers la copie GitHub de l'élève.
// Le nom GitHub et le nom de la copie sont repris de la configuration (même navigateur), si possible.

const $ = (id) => document.getElementById(id);
const lire = (k) => { try { return localStorage.getItem(k) ?? ""; } catch { return ""; } };
const ecrire = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

$("login").value = lire("login");
$("depot").value = lire("depot") || "pronote-ical";

const propre = (s) => s.trim().replace(/^@/, "").replace(/^.*github\.com\//, "").split("/")[0];

function majLiens() {
  const login = propre($("login").value);
  const depot = propre($("depot").value) || "pronote-ical";
  const base = login ? `https://github.com/${login}/${depot}` : null;
  const liens = {
    workflow: base ? `${base}/actions/workflows/sync.yml` : "https://github.com",
    reglages: base ? `${base}/settings` : "https://github.com",
    gists: login ? `https://gist.github.com/${login}` : "https://gist.github.com",
    cles: "https://github.com/settings/personal-access-tokens",
  };
  for (const a of document.querySelectorAll("[data-lien]")) a.href = liens[a.dataset.lien];
  $("info").className = "statut" + (login ? " ok" : "");
  $("info").textContent = login
    ? `Liens réglés pour ${login}/${depot} ✓`
    : "Sans ton nom, les liens ouvrent GitHub : tu choisiras ta copie toi-même.";
  if (login) { ecrire("login", login); ecrire("depot", depot); }
}

$("login").addEventListener("input", majLiens);
$("depot").addEventListener("input", majLiens);
majLiens();
