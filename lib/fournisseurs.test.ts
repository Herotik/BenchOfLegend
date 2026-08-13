import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exportPKCS8, generateKeyPair, jwtVerify, decodeProtectedHeader } from "jose";
import { emailVerifie, fournisseursActifs } from "./fournisseurs";

/**
 * Le secret d'Apple et la garde d'e-mail vérifié.
 *
 * Ce sont les deux endroits où une erreur ne se voit pas : un secret mal formé
 * ne se manifeste que par un `invalid_client` chez Apple, et une garde trop
 * permissive ne se manifeste jamais — c'est bien le problème.
 */

const ENV_ORIGINE = { ...process.env };

afterEach(() => {
  process.env = { ...ENV_ORIGINE };
});

describe("fournisseursActifs", () => {
  beforeEach(() => {
    for (const cle of Object.keys(process.env)) {
      if (cle.startsWith("AUTH_")) delete process.env[cle];
    }
  });

  it("n'en propose aucun sans identifiants", () => {
    expect(fournisseursActifs()).toEqual([]);
  });

  it("ignore une variable créée sans valeur", () => {
    // Le cas vécu en production : la variable existe chez l'hébergeur, mais
    // vide. Elle doit compter pour absente, sinon Auth.js démarre un
    // fournisseur incapable de signer quoi que ce soit.
    process.env.AUTH_GOOGLE_ID = "id";
    process.env.AUTH_GOOGLE_SECRET = "";

    expect(fournisseursActifs()).toEqual([]);
  });

  it("propose chaque fournisseur complètement renseigné, dans l'ordre d'affichage", () => {
    process.env.AUTH_DISCORD_ID = "id";
    process.env.AUTH_DISCORD_SECRET = "secret";
    process.env.AUTH_GOOGLE_ID = "id";
    process.env.AUTH_GOOGLE_SECRET = "secret";

    expect(fournisseursActifs().map((f) => f.id)).toEqual(["google", "discord"]);
  });

  it("exige les quatre valeurs d'Apple", () => {
    process.env.AUTH_APPLE_ID = "com.exemple.web";
    process.env.AUTH_APPLE_TEAM_ID = "EQUIPE";
    process.env.AUTH_APPLE_KEY_ID = "CLE";

    expect(fournisseursActifs()).toEqual([]);

    process.env.AUTH_APPLE_PRIVATE_KEY = "clé";
    expect(fournisseursActifs().map((f) => f.id)).toEqual(["apple"]);
  });
});

describe("secretApple", () => {
  /**
   * Vraie paire ES256 : le secret est vérifié, pas seulement décodé.
   *
   * Le module est rechargé à chaque fois — `secretApple` garde son jeton en
   * mémoire, et un cas hériterait sinon du jeton du précédent, signé par une
   * autre clé.
   */
  async function preparer() {
    vi.resetModules();
    const { privateKey, publicKey } = await generateKeyPair("ES256", { extractable: true });
    process.env.AUTH_APPLE_PRIVATE_KEY = await exportPKCS8(privateKey);
    process.env.AUTH_APPLE_TEAM_ID = "EQUIPE12345";
    process.env.AUTH_APPLE_KEY_ID = "CLE67890";
    process.env.AUTH_APPLE_ID = "com.frameoflegends.web";

    const { secretApple } = await import("./fournisseurs");
    return { publicKey, secretApple };
  }

  it("signe un jeton qu'Apple pourrait vérifier", async () => {
    const { publicKey, secretApple } = await preparer();

    const jeton = await secretApple();
    const { payload } = await jwtVerify(jeton, publicKey, {
      audience: "https://appleid.apple.com",
      issuer: "EQUIPE12345",
    });

    // `iss` est l'équipe, `sub` l'identifiant de service : les intervertir
    // donne un `invalid_client` qu'aucun message n'explique.
    expect(payload.sub).toBe("com.frameoflegends.web");
    expect(decodeProtectedHeader(jeton)).toMatchObject({ alg: "ES256", kid: "CLE67890" });
  });

  it("reste sous le plafond de six mois d'Apple", async () => {
    const { publicKey, secretApple } = await preparer();

    const { payload } = await jwtVerify(await secretApple(), publicKey);

    const duree = (payload.exp ?? 0) - (payload.iat ?? 0);
    expect(duree).toBeGreaterThan(0);
    expect(duree).toBeLessThan(60 * 60 * 24 * 180);
  });

  it("accepte une clé dont les sauts de ligne ont été échappés", async () => {
    // Certaines interfaces de variables d'environnement rendent les sauts de
    // ligne d'un PEM littéralement `\n`. Refuser cette forme obligerait à
    // deviner la bonne façon de coller sa clé.
    const { publicKey, secretApple } = await preparer();
    process.env.AUTH_APPLE_PRIVATE_KEY = process.env.AUTH_APPLE_PRIVATE_KEY!.replace(/\n/g, "\\n");

    await expect(jwtVerify(await secretApple(), publicKey)).resolves.toBeDefined();
  });

  it("resigne un jeton neuf quand la clé change", async () => {
    const premier = await preparer();
    const jetonInitial = await premier.secretApple();

    const second = await preparer();
    expect(await second.secretApple()).not.toBe(jetonInitial);
  });
});

describe("emailVerifie", () => {
  it("exige la mention de Google", () => {
    expect(emailVerifie("google", { email_verified: true })).toBe(true);
    expect(emailVerifie("google", { email_verified: false })).toBe(false);
    expect(emailVerifie("google", {})).toBe(false);
  });

  it("accepte la chaîne « true », qu'Apple renvoie parfois", () => {
    expect(emailVerifie("apple", { email_verified: "true" })).toBe(true);
  });

  it("fait confiance à Apple en l'absence de mention", () => {
    // Apple ne délivre que des adresses qu'il a vérifiées ou qu'il possède.
    expect(emailVerifie("apple", {})).toBe(true);
    expect(emailVerifie("apple", { email_verified: false })).toBe(false);
  });

  it("exige la mention de Discord, qui la nomme autrement", () => {
    expect(emailVerifie("discord", { verified: true })).toBe(true);
    expect(emailVerifie("discord", { verified: false })).toBe(false);
    expect(emailVerifie("discord", { email_verified: true })).toBe(false);
  });

  it("refuse ce qu'il ne sait pas juger", () => {
    // Refus par défaut : un fournisseur ajouté sans être déclaré ici bloque
    // ses connexions plutôt que de les laisser passer sans contrôle.
    expect(emailVerifie("github", { email_verified: true })).toBe(false);
    expect(emailVerifie("google", null)).toBe(false);
    expect(emailVerifie("google", "oui")).toBe(false);
  });
});
