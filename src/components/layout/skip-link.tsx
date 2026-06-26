/**
 * Skip link — first focusable element for keyboard users (WCAG + Fitts's Law).
 */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-ads-overlay"
    >
      Skip to main content
    </a>
  );
}
