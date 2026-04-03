import { revalidateTag } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const secret = process.env.REVALIDATION_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "REVALIDATION_SECRET not configured" },
      { status: 500 }
    );
  }

  revalidateTag("metrics", "max");
  revalidateTag("news", "max");

  return NextResponse.json({ revalidated: true, tags: ["metrics", "news"] });
}
