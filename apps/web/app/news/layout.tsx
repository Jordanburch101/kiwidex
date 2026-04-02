import { Footer } from "@/components/sections/footer";
import { Masthead } from "@/components/sections/masthead";

export default function NewsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f4f2ed]">
      <div className="mx-auto min-h-screen max-w-[1200px] border-[#e5e0d5] border-x bg-[#faf9f6]">
        <div className="px-6 py-6">
          <Masthead />
        </div>
        <main>{children}</main>
        <Footer />
      </div>
    </div>
  );
}
