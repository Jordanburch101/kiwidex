import type { Collector } from "./types";
import collectRBNZ from "./rbnz/index";

export const registry: Record<string, Collector> = {
  rbnz: collectRBNZ,
};
