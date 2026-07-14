import { useEffect } from "react";

let lockCount = 0;
let previousHtmlOverflow = "";
let previousHtmlOverscrollBehavior = "";
let previousBodyOverflow = "";
let previousBodyOverscrollBehavior = "";
let previousBodyPaddingRight = "";
let previousBodyPosition = "";
let previousBodyTop = "";
let previousBodyWidth = "";
let lockedScrollY = 0;

export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof window === "undefined") return;

    const html = document.documentElement;
    const body = document.body;
    if (lockCount === 0) {
      lockedScrollY = window.scrollY || html.scrollTop || body.scrollTop || 0;
      previousHtmlOverflow = html.style.overflow;
      previousHtmlOverscrollBehavior = html.style.overscrollBehavior;
      previousBodyOverflow = body.style.overflow;
      previousBodyOverscrollBehavior = body.style.overscrollBehavior;
      previousBodyPaddingRight = body.style.paddingRight;
      previousBodyPosition = body.style.position;
      previousBodyTop = body.style.top;
      previousBodyWidth = body.style.width;

      const scrollbarWidth = window.innerWidth - html.clientWidth;
      html.dataset.scrollLock = "true";
      html.style.overflow = "hidden";
      html.style.overscrollBehavior = "none";
      body.style.overflow = "hidden";
      body.style.overscrollBehavior = "none";
      body.style.position = "fixed";
      body.style.top = `-${lockedScrollY}px`;
      body.style.width = "100%";
      if (scrollbarWidth > 0) {
        body.style.paddingRight = `${scrollbarWidth}px`;
      }
    }

    lockCount += 1;

    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) {
        delete html.dataset.scrollLock;
        html.style.overflow = previousHtmlOverflow;
        html.style.overscrollBehavior = previousHtmlOverscrollBehavior;
        body.style.overflow = previousBodyOverflow;
        body.style.overscrollBehavior = previousBodyOverscrollBehavior;
        body.style.paddingRight = previousBodyPaddingRight;
        body.style.position = previousBodyPosition;
        body.style.top = previousBodyTop;
        body.style.width = previousBodyWidth;
        window.scrollTo(0, lockedScrollY);
      }
    };
  }, [active]);
}
