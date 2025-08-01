import crypto from "crypto";

const algorithm = "aes-256-gcm";
const secretKey = process.env.ENCRYPTION_KEY!; // Must be 32 bytes

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const key = Buffer.from(secretKey, "utf8");
  const cipher = crypto.createCipheriv(algorithm, key, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  // Return iv:authTag:encrypted format
  return iv.toString("hex") + ":" + authTag.toString("hex") + ":" + encrypted;
}

export function decrypt(encryptedData: string): string {
  const parts = encryptedData.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted data format");
  }

  const [ivHex, authTagHex, encrypted] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const key = Buffer.from(secretKey, "utf8");

  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

// Helper function to safely decrypt (returns null if decryption fails)
export function safeDecrypt(
  encryptedData: string | null | undefined
): string | null {
  if (!encryptedData) return null;

  try {
    return decrypt(encryptedData);
  } catch (error) {
    console.error("Decryption failed:", error);
    return null;
  }
}
