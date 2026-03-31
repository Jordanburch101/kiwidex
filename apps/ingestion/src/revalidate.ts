export async function revalidateWeb() {
  const url = process.env.WEB_URL;
  if (!url) {
    return;
  }

  const secret = process.env.REVALIDATION_SECRET;
  const headers: Record<string, string> = {};
  if (secret) {
    headers.authorization = `Bearer ${secret}`;
  }

  try {
    const res = await fetch(`${url}/api/revalidate`, {
      method: "POST",
      headers,
    });
    console.log(`[revalidate] ${res.status} ${res.statusText}`);
  } catch (e) {
    console.error("[revalidate] failed:", e);
  }
}
