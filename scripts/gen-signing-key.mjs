// Prints a fresh Ed25519 private key for ORBIT_SIGNING_KEY (base64 PKCS8 PEM). Run once, paste into Vercel / .env.local.
import { generateKeyPairSync } from "node:crypto";

const { privateKey } = generateKeyPairSync("ed25519");
const pem = privateKey.export({ type: "pkcs8", format: "pem" });
process.stdout.write(`ORBIT_SIGNING_KEY=${Buffer.from(pem).toString("base64")}\n`);
