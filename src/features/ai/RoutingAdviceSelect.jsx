import React, { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CaretDown } from "@phosphor-icons/react";
import { getRoutingAdviceSelectKeyAction } from "./routingAdviceSelectKeyboard.js";

export default function RoutingAdviceSelect({ ariaLabel, value, options, onChange, disabled = false, testId }) {
  const id = useId();
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const listboxRef = useRef(null);
  const optionRefs = useRef([]);
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState(null);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const [activeIndex, setActiveIndex] = useState(Math.max(0, selectedIndex));
  const activeOption = options[activeIndex];
  const selectedOption = options[selectedIndex];

  useEffect(() => {
    if (!isOpen) return undefined;
    const closeOutside = (event) => {
      if (!rootRef.current?.contains(event.target) && !listboxRef.current?.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) { setMenuPosition(null); return undefined; }
    const positionMenu = (event) => {
      if (event?.target === listboxRef.current) return;
      const trigger = triggerRef.current;
      const listbox = listboxRef.current;
      if (!trigger || !listbox) return;
      const rect = trigger.getBoundingClientRect();
      const triggerStyle = getComputedStyle(trigger);
      listbox.style.fontFamily = triggerStyle.fontFamily;
      listbox.style.fontSize = triggerStyle.fontSize;
      listbox.style.fontWeight = triggerStyle.fontWeight;
      listbox.style.lineHeight = triggerStyle.lineHeight;
      const margin = 8;
      const gap = 5;
      const maxHeight = Math.max(1, Math.min(252, window.innerHeight - margin * 2));
      const desiredHeight = Math.min(listbox.scrollHeight, maxHeight);
      const below = Math.max(0, window.innerHeight - rect.bottom - gap - margin);
      const above = Math.max(0, rect.top - gap - margin);
      const placement = below >= desiredHeight || below >= above ? "bottom" : "top";
      const available = Math.max(1, Math.min(maxHeight, placement === "bottom" ? below : above));
      const height = Math.min(desiredHeight, available);
      const top = placement === "bottom" ? Math.max(margin, Math.min(rect.bottom + gap, window.innerHeight - height - margin)) : Math.max(margin, rect.top - gap - height);
      const maxWidth = Math.max(112, Math.min(280, window.innerWidth - margin * 2));
      const width = Math.max(Math.min(rect.width, maxWidth), Math.min(listbox.scrollWidth, maxWidth), Math.min(196, maxWidth));
      const left = Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin));
      setMenuPosition({ top, left, width, maxHeight: height });
    };
    positionMenu();
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", positionMenu, true);
    return () => {
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
    };
  }, [isOpen, options.length]);

  useEffect(() => {
    if (isOpen) optionRefs.current[activeIndex]?.scrollIntoView?.({ block: "nearest" });
  }, [activeIndex, isOpen]);

  const closeAndFocus = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };
  const choose = (option) => {
    if (!option || disabled) return;
    onChange(option.value);
    closeAndFocus();
  };
  const onKeyDown = (event) => {
    if (disabled) return;
    const action = getRoutingAdviceSelectKeyAction(event.key, { isOpen, activeIndex, optionCount: options.length, selectedIndex });
    if (action.type === "none") return;
    if (action.type === "close-and-tab") { setIsOpen(false); return; }
    event.preventDefault();
    if (action.type === "close") { closeAndFocus(); return; }
    if (action.type === "open") { setActiveIndex(action.activeIndex); setIsOpen(true); return; }
    if (action.type === "move") { setActiveIndex(action.activeIndex); return; }
    if (action.type === "select") choose(options[action.activeIndex]);
  };

  return <div className="routing-advice-select" ref={rootRef} data-testid={`${testId}-custom`}>
    <button
      ref={triggerRef}
      type="button"
      className="routing-advice-select__trigger"
      role="combobox"
      aria-label={ariaLabel}
      aria-haspopup="listbox"
      aria-expanded={isOpen}
      aria-controls={`${id}-listbox`}
      aria-activedescendant={isOpen && activeOption ? `${id}-option-${activeIndex}` : undefined}
      data-testid={testId}
      disabled={disabled}
      onKeyDown={onKeyDown}
      onClick={() => {
        if (isOpen) { setIsOpen(false); return; }
        setActiveIndex(Math.max(0, selectedIndex));
        setIsOpen(true);
      }}
    >
      <span>{selectedOption?.label ?? "UNKNOWN"}</span><CaretDown size={13} weight="bold" aria-hidden="true" />
    </button>
    {isOpen && createPortal(<ul
      ref={listboxRef}
      className="routing-advice-select__listbox"
      id={`${id}-listbox`}
      role="listbox"
      aria-label={ariaLabel}
      data-owner={testId}
      data-testid={`${testId}-listbox`}
      style={{ ...(menuPosition || { visibility: "hidden" }), ...(menuPosition ? {} : { top: 0, left: 0 }), position: "fixed" }}
    >{options.map((option, index) => <li
        key={option.value}
        ref={(element) => { optionRefs.current[index] = element; }}
        id={`${id}-option-${index}`}
        role="option"
        aria-selected={option.value === value}
        data-value={option.value}
        className={index === activeIndex ? "is-active" : ""}
        data-testid={`${testId}-option-${index}`}
        onMouseEnter={() => setActiveIndex(index)}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => choose(option)}
      >{option.label}</li>)}
    </ul>, document.body)}
  </div>;
}
