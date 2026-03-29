import collectRBNZ from "./rbnz/index";
import type { Collector } from "./types";

export const registry: Record<string, Collector> = {
  rbnz: collectRBNZ,
};
