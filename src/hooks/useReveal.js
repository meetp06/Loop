import { useRef, useEffect } from 'react';

/**
 * Scroll-reveal hook — observes `.reveal` children (and the ref element
 * itself if it carries the class) and adds `.in` when they enter the viewport.
 */
export default function useReveal() {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.16 }
    );

    el.querySelectorAll('.reveal').forEach((n) => io.observe(n));
    if (el.classList.contains('reveal')) io.observe(el);

    return () => io.disconnect();
  }, []);

  return ref;
}
