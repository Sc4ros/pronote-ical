// Outils de la page de configuration mobile (navigateur). Compilé dans site/outils.js
// par « npm run build:mobile ». Aussi importé tel quel par test/test-mobile.js.
import nacl from "tweetnacl";
import { blake2b } from "blakejs";
import jsQR from "jsqr";

export { jsQR };

const octets = (texte) => new TextEncoder().encode(texte);
const versBase64 = (u8) => btoa(String.fromCharCode(...u8));
const depuisBase64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

/** Même format que chiffrer() de src/coeur.js : base64(iv[12] | tag[16] | données),
 *  clé AES-256-GCM = SHA-256(secret). */
export async function chiffrer(objet, secret) {
  const cle = await crypto.subtle.importKey(
    "raw", await crypto.subtle.digest("SHA-256", octets(secret)), "AES-GCM", false, ["encrypt"],
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sortie = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cle, octets(JSON.stringify(objet))));
  const donnees = sortie.subarray(0, sortie.length - 16), tag = sortie.subarray(sortie.length - 16);
  const tout = new Uint8Array(12 + 16 + donnees.length);
  tout.set(iv, 0); tout.set(tag, 12); tout.set(donnees, 28);
  return versBase64(tout);
}

/** « Sealed box » libsodium (crypto_box_seal) : format exigé par GitHub pour les secrets. */
export function sceller(texte, clePubliqueB64) {
  const pk = depuisBase64(clePubliqueB64);
  const eph = nacl.box.keyPair();
  const entree = new Uint8Array(64);
  entree.set(eph.publicKey, 0); entree.set(pk, 32);
  const nonce = blake2b(entree, undefined, 24);
  const boite = nacl.box(octets(texte), nonce, pk, eph.secretKey);
  const sortie = new Uint8Array(32 + boite.length);
  sortie.set(eph.publicKey, 0); sortie.set(boite, 32);
  return versBase64(sortie);
}

export function nouvelleCle() {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return versBase64(b).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
