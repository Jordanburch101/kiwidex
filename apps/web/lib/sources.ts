export const SOURCE_INFO: Record<
  string,
  { label: string; logo: string; bg: string }
> = {
  rnz: { label: "RNZ", logo: "/sources/rnz.svg", bg: "#D42C21" },
  stuff: { label: "Stuff", logo: "/sources/stuff.png", bg: "#6443AB" },
  herald: { label: "Herald", logo: "/sources/herald.png", bg: "#0D0D0D" },
  "1news": { label: "1News", logo: "/sources/1news.svg", bg: "#00274e" },
  newsroom: {
    label: "Newsroom",
    logo: "/sources/newsroom.png",
    bg: "#000000",
  },
  interest: {
    label: "Interest",
    logo: "/sources/interest.png",
    bg: "#18468b",
  },
  guardian: {
    label: "Guardian",
    logo: "/sources/guardian.png",
    bg: "#052962",
  },
  edairynews: {
    label: "eDairy",
    logo: "/sources/edairynews.png",
    bg: "#013091",
  },
  scmp: { label: "SCMP", logo: "/sources/scmp.png", bg: "#001246" },
  abc: { label: "ABC AU", logo: "/sources/abc.svg", bg: "#1E5AEB" },
  bbc: { label: "BBC", logo: "/sources/bbc.png", bg: "#BB1919" },
};

export function parseSources(json: string | null): string[] {
  if (!json) {
    return [];
  }
  try {
    return JSON.parse(json) as string[];
  } catch {
    return [];
  }
}
