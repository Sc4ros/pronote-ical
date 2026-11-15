// Test hors-ligne : faux emploi du temps → fichiers .ics dans ./sortie/
process.env.TZ = "Europe/Paris";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { construireCalendriers, emojiCouleur } from "../src/ics.js";

const h = (jour, hh, mm = 0) => new Date(2026, 10, jour, hh, mm);

const classes = [
  { is: "lesson", id: "1", startDate: h(16, 8), endDate: h(16, 9), subject: { name: "MATHÉMATIQUES" },
    teacherNames: ["M. DUPONT"], classrooms: ["B204"], groupNames: [], personalNames: [], virtualClassrooms: [],
    backgroundColor: "#2F6FDE", canceled: false, exempted: false, test: true },
  { is: "lesson", id: "2", startDate: h(16, 9), endDate: h(16, 10), subject: { name: "PHYSIQUE-CHIMIE" },
    teacherNames: ["Mme MARTIN"], classrooms: ["Labo 3"], groupNames: ["Gr. 1"], personalNames: [], virtualClassrooms: [],
    backgroundColor: "#FF9900", canceled: true, status: "Prof. absent", exempted: false, test: false,
    notes: "Ramener la blouse; et la calculatrice, merci" },
  { is: "lesson", id: "3", startDate: h(17, 14), endDate: h(17, 16), subject: { name: "MATHÉMATIQUES" },
    teacherNames: ["M. DUPONT"], classrooms: ["C101"], groupNames: [], personalNames: [], virtualClassrooms: [],
    backgroundColor: "#2F6FDE", canceled: false, status: "Changement de salle", exempted: false, test: false },
  { is: "detention", id: "4", startDate: h(19, 17), endDate: h(19, 18), title: "Travail non fait",
    teacherNames: ["M. DURAND"], personalNames: [], classrooms: ["Permanence"] },
  { is: "activity", id: "5", startDate: h(20, 13), endDate: h(20, 14), title: "Club théâtre",
    attendants: [], resourceTypeName: "Salle", resourceValue: "Foyer" },
];

const { fichiers, matieres } = construireCalendriers(classes, { nomEleve: "Test Élève" });
mkdirSync("sortie", { recursive: true });
for (const [nom, contenu] of Object.entries(fichiers)) writeFileSync(`sortie/${nom}`, contenu);

const tout = fichiers["emploi-du-temps.ics"];
assert.equal((tout.match(/BEGIN:VEVENT/g) ?? []).length, 5);
assert.match(tout, /SUMMARY:🟦 📝 DS – MATHÉMATIQUES/);
assert.match(tout, /SUMMARY:🟧 ❌ ANNULÉ – PHYSIQUE-CHIMIE \(Prof\. absent\)/);
assert.match(tout, /DTSTART:20261116T070000Z/); // 8h Paris (hiver) = 7h UTC
assert.match(tout.replace(/\r\n /g, ""), /Ramener la blouse\\; et la calculatrice\\, merci/);
assert.ok(tout.split("\r\n").every((l) => Buffer.byteLength(l) <= 75), "lignes > 75 octets");
assert.deepEqual(matieres.map((m) => m.fichier).sort(), [
  "activites.ics", "matiere-mathematiques.ics", "matiere-physique-chimie.ics", "retenues.ics",
]);
assert.match(fichiers["matiere-mathematiques.ics"], /X-APPLE-CALENDAR-COLOR:#2F6FDE/);

const sansAnnules = construireCalendriers(classes, { afficherAnnules: false }).fichiers["emploi-du-temps.ics"];
assert.equal((sansAnnules.match(/BEGIN:VEVENT/g) ?? []).length, 4);

assert.equal(emojiCouleur("#00AA00"), "🟩");
assert.equal(emojiCouleur("#8B4513"), "🟫");

console.log("✅ Tous les tests passent. Fichiers générés dans ./sortie/ :", Object.keys(fichiers).join(", "));
