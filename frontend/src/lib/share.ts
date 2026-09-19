export function workerLink(token: string): string {
  return `${window.location.origin}/wo/${token}`;
}

export function frontendWorkerLink(shareOrToken: string): string {
  const idx = shareOrToken.lastIndexOf("/wo/");
  if (idx >= 0) return `${window.location.origin}${shareOrToken.slice(idx)}`;
  return workerLink(shareOrToken);
}

export async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

export async function shareOrCopy(text: string, title = "Technician link"): Promise<"shared" | "copied"> {
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url: text });
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") throw err;
    }
  }
  await copyText(text);
  return "copied";
}
