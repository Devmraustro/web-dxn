import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * ScrollToTop
 *
 * Global scroll restoration for client-side route navigation.
 * On every pathname change, scrolls the window to the top (0, 0)
 * with `behavior: "auto"` (no smooth animation) to match native
 * browser behavior for full-page navigations.
 *
 * This component must be rendered once inside a <Routes> context
 * so it has access to the current location.
 */
export const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);

  return null;
};