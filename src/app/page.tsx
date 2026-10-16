import { HomeWorkspace } from "@/components/home-workspace";
import { SiteIntro } from "@/components/site-intro";

export default function HomePage() {
  return (
    <main className="mx-auto w-full max-w-[var(--page-max)] flex-1 px-5 py-8 sm:py-12">
      <SiteIntro>
        <HomeWorkspace />
      </SiteIntro>
    </main>
  );
}
