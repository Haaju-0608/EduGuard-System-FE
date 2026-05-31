// Helper utility functions

/**
 * Scroll-reveal observer setup
 * Call this in useEffect to observe elements with class 'reveal'
 */
export function setupScrollReveal(): () => void {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    },
    { threshold: 0.12 }
  );

  document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));

  return () => observer.disconnect();
}
