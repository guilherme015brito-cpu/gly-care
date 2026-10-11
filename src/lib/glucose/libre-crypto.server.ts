function keyBytes(secret: string) {
  if (!/^[a-f0-9]{64}$/i.test(secret)) throw new Error("Invalid Libre encryption key");
  return Uint8Array.from(secret.match(/../g)!, (n) => parseInt(n, 16));
}
export async function sealLibre(value: unknown, secret: string, scope: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", keyBytes(secret), "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(scope) },
    key,
    new TextEncoder().encode(JSON.stringify(value)),
  );
  return JSON.stringify({ iv: [...iv], data: [...new Uint8Array(ciphertext)] });
}
export async function openLibre(value: string, secret: string, scope: string): Promise<unknown> {
  const payload = JSON.parse(value) as { iv: number[]; data: number[] };
  const key = await crypto.subtle.importKey("raw", keyBytes(secret), "AES-GCM", false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: new Uint8Array(payload.iv),
      additionalData: new TextEncoder().encode(scope),
    },
    key,
    new Uint8Array(payload.data),
  );
  return JSON.parse(new TextDecoder().decode(plain));
}
