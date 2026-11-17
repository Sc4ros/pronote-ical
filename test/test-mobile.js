// Vérifie que la page mobile chiffre exactement comme attendu :
//  1. l'état chiffré dans le navigateur est lisible par src/coeur.js (GitHub Actions)
//  2. les secrets scellés sont lisibles par libsodium (ce qu'utilise GitHub)
import assert from "node:assert/strict";
import sodium from "libsodium-wrappers";
import { dechiffrer } from "../src/coeur.js";
import { chiffrer, nouvelleCle, sceller } from "../src/web/outils.js";
globalThis.self ??= globalThis; // comme dans un navigateur (tweetnacl y cherche self.crypto)
const compile = await import("../site/outils.js");

for (const outils of [{ chiffrer, nouvelleCle, sceller }, compile]) {
  const cle = outils.nouvelleCle();
  assert.match(cle, /^[A-Za-z0-9_-]{43}$/);
  const etat = { qr: { url: "https://x.index-education.net/pronote/", jeton: "é€", login: "abc" }, pin: "1234", deviceUUID: "u" };
  assert.deepEqual(dechiffrer(await outils.chiffrer(etat, cle), cle), etat);
  const autre = await outils.chiffrer(etat, cle);
  assert.throws(() => dechiffrer(autre, "mauvaise"));

  await sodium.ready;
  const paire = sodium.crypto_box_keypair();
  const scelle = outils.sceller("ghp_secret-àé", sodium.to_base64(paire.publicKey, sodium.base64_variants.ORIGINAL));
  const ouvert = sodium.crypto_box_seal_open(
    sodium.from_base64(scelle, sodium.base64_variants.ORIGINAL), paire.publicKey, paire.privateKey,
  );
  assert.equal(sodium.to_string(ouvert), "ghp_secret-àé");
}
console.log("✅ Chiffrement de la page mobile compatible (état + secrets GitHub)");
