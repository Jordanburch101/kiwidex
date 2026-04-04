export function parseTags(tags: string): string[] {
  try {
    return JSON.parse(tags) as string[];
  } catch {
    return [];
  }
}

export function parseAngles(
  angles: string | null
): { source: string; angle: string; description: string }[] {
  if (!angles) {
    return [];
  }
  try {
    return JSON.parse(angles) as {
      source: string;
      angle: string;
      description: string;
    }[];
  } catch {
    return [];
  }
}

export function getAngleForSource(
  angles: { source: string; angle: string; description: string }[],
  source: string
): { angle: string; description: string } | undefined {
  return angles.find((a) => a.source.toLowerCase() === source.toLowerCase());
}

export function formatNewsDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
