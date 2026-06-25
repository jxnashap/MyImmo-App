// Hängt eine Flash-Nachricht an eine Redirect-URL. Der FlashToast-Reader im
// Layout zeigt sie nach der Navigation als Toast und entfernt den Parameter.
export function flashUrl(url: string, msg: string): string {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}flash=${encodeURIComponent(msg)}`;
}
