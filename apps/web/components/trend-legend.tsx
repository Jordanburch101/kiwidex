"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";

interface TrendLegendProps {
  colors: {
    rising: string;
    stable: string;
    falling: string;
  };
}

const LEGEND_ITEMS = [
  {
    key: "rising" as const,
    label: "Rising",
    description: "Price up more than 2% from early average",
  },
  {
    key: "stable" as const,
    label: "Stable",
    description: "Price within \u00B12% of early average",
  },
  {
    key: "falling" as const,
    label: "Falling",
    description: "Price down more than 2% from early average",
  },
];

export function TrendLegend({ colors }: TrendLegendProps) {
  return (
    <TooltipProvider>
      <div className="flex items-center gap-4 text-[#998] text-xs">
        {LEGEND_ITEMS.map((item) => (
          <Tooltip key={item.key}>
            <TooltipTrigger className="flex cursor-default items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: colors[item.key] }}
              />
              {item.label}
            </TooltipTrigger>
            <TooltipContent>{item.description}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
