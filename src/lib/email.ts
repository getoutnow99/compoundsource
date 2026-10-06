import "server-only";

// Emails never contain patient details: only order numbers, clinic names and links back to the site.
export async function sendEmail(to: string, subject: string, text: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[email] to=${to} subject=${subject}\n${text}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject, text }),
  });
  if (!res.ok) console.error(`[email] send failed: ${res.status} ${await res.text()}`);
}

export const appUrl = (path: string) => `${process.env.APP_URL || "http://localhost:3000"}${path}`;
