import type { LucideIcon } from "lucide-react";
import { MoreHorizontal } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

import { cn } from "../../lib/cn";
import type { ActionTone } from "./actionTone";
import { Button } from "./Button";
import { PopoverSurface } from "./Overlay";

const actionMenuToneClasses: Record<ActionTone, string> = {
  brand: "text-[var(--zani-brand-content)] hover:bg-brand-50",
  neutral: "text-zani-text hover:bg-surface-warm",
  warning: "text-zani-warning hover:bg-[var(--zani-warning-soft)]",
  danger: "text-zani-danger hover:bg-[var(--zani-danger-soft)]",
  ai: "text-ai-700 hover:bg-ai-50",
};

export type ActionMenuItem = {
  key: string;
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  tone?: ActionTone;
  disabled?: boolean;
};

export function ActionMenu({
  label,
  items,
  disabled = false,
}: {
  label: string;
  items: ActionMenuItem[];
  disabled?: boolean;
}) {
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 8, top: 8 });

  useLayoutEffect(() => {
    if (!open) return undefined;

    const placeMenu = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const width = 224;
      const height = menuRef.current?.offsetHeight || items.length * 40 + 16;
      const left = Math.min(
        Math.max(8, rect.right - width),
        Math.max(8, window.innerWidth - width - 8),
      );
      const preferredTop = rect.bottom + 6;
      const top = preferredTop + height <= window.innerHeight - 8
        ? preferredTop
        : Math.max(8, rect.top - height - 6);
      setPosition({ left, top });
    };

    placeMenu();
    const frameId = window.requestAnimationFrame(() => {
      placeMenu();
      menuRef.current?.querySelector<HTMLButtonElement>("[role='menuitem']:not([disabled])")?.focus();
    });
    window.addEventListener("resize", placeMenu);
    window.addEventListener("scroll", placeMenu, true);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", placeMenu);
      window.removeEventListener("scroll", placeMenu, true);
    };
  }, [items.length, open]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [open]);

  function closeAndRestoreFocus() {
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  }

  function handleMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const enabledItems = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>("[role='menuitem']:not([disabled])"),
    );
    const currentIndex = enabledItems.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "Escape") {
      event.preventDefault();
      closeAndRestoreFocus();
      return;
    }
    if (event.key === "Tab") {
      setOpen(false);
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) || !enabledItems.length) return;
    event.preventDefault();
    if (event.key === "Home") enabledItems[0].focus();
    else if (event.key === "End") enabledItems.at(-1)?.focus();
    else if (event.key === "ArrowDown") enabledItems[(currentIndex + 1 + enabledItems.length) % enabledItems.length].focus();
    else enabledItems[(currentIndex - 1 + enabledItems.length) % enabledItems.length].focus();
  }

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        variant="icon"
        size="icon"
        className="ml-auto h-9 min-h-9 w-9"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        data-testid="row-actions-trigger"
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
      >
        <MoreHorizontal aria-hidden="true" size={17} />
      </Button>
      {open ? createPortal(
        <PopoverSurface
          ref={menuRef}
          id={menuId}
          role="menu"
          data-testid="action-menu"
          aria-label={label}
          className="fixed z-[var(--zani-z-popover)] w-56 p-1.5"
          style={position}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={handleMenuKeyDown}
        >
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                data-action-key={item.key}
                disabled={item.disabled}
                className={cn(
                  "zani-focus-ring flex min-h-10 w-full items-center gap-2 rounded-control px-3 py-2 text-left text-sm font-semibold transition disabled:pointer-events-none disabled:opacity-50",
                  actionMenuToneClasses[item.tone || "neutral"],
                )}
                onClick={() => {
                  closeAndRestoreFocus();
                  item.onSelect();
                }}
              >
                <Icon aria-hidden="true" size={16} />
                {item.label}
              </button>
            );
          })}
        </PopoverSurface>,
        document.body,
      ) : null}
    </>
  );
}
