export type ImageCandidate = { url: string; thumbnailUrl?: string; width?: number; height?: number; sourceUrl?: string; sourceDomain?: string; title?: string };

export async function searchImageCandidates(query: string, limit = 20): Promise<ImageCandidate[]> {
  const endpoint = process.env.SOCIAL_IMAGE_SEARCH_ENDPOINT?.trim();
  const key = process.env.SOCIAL_IMAGE_SEARCH_API_KEY?.trim();
  if (!endpoint || !key) return [];
  const url = new URL(endpoint);
  url.searchParams.set("q", query);
  url.searchParams.set("count", String(Math.min(limit, 50)));
  const response = await fetch(url, { headers: { "Ocp-Apim-Subscription-Key": key }, cache: "no-store" });
  if (!response.ok) throw new Error(`Image search HTTP ${response.status}`);
  const json = await response.json() as any;
  return (json.value || []).map((item: any) => ({ url: item.contentUrl, thumbnailUrl: item.thumbnailUrl, width: item.width, height: item.height, sourceUrl: item.hostPageUrl, sourceDomain: item.hostPageDomainFriendlyName, title: item.name }));
}
