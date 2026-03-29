import collectElectricity from "./electricity/index";
import collectMinimumWage from "./minimum-wage/index";
import collectPetrol from "./petrol/index";
import collectRBNZ from "./rbnz/index";
import collectREINZ from "./reinz/index";
import collectStatsNZ from "./stats-nz/index";
import type { Collector } from "./types";

export const registry: Record<string, Collector> = {
  rbnz: collectRBNZ,
  "stats-nz": collectStatsNZ,
  reinz: collectREINZ,
  petrol: collectPetrol,
  electricity: collectElectricity,
  "minimum-wage": collectMinimumWage,
};
