import collectRBNZ from "./rbnz/index";
import collectREINZ from "./reinz/index";
import collectStatsNZ from "./stats-nz/index";
import type { Collector } from "./types";

export const registry: Record<string, Collector> = {
  rbnz: collectRBNZ,
  "stats-nz": collectStatsNZ,
  reinz: collectREINZ,
};
