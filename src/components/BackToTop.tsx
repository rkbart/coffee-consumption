import { useEffect, useState } from "react";
import { IconArrowUp } from "./Icons";

export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const scrollContainer = document.getElementById("app-main");
    if (!scrollContainer) return;

    const onContainerScroll = () => setVisible(scrollContainer.scrollTop > 500);
    onContainerScroll();
    scrollContainer.addEventListener("scroll", onContainerScroll, { passive: true });
    return () => scrollContainer.removeEventListener("scroll", onContainerScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      className="fixed bottom-4 right-4 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-ink text-white shadow-lg transition-colors hover:bg-accent-dark focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 sm:bottom-6 sm:right-6"
      onClick={() => document.getElementById("app-main")?.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Back to top"
      title="Back to top"
    >
      <IconArrowUp size={17} />
      <span className="sr-only">Top</span>
    </button>
  );
}
