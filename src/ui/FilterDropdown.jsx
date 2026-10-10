import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CaretDown, MagnifyingGlass } from "@phosphor-icons/react";

// Shared preview UI control. Render the menu in a portal so scrollable toolbars cannot clip it.
export function FilterDropdown({ label, value, options, onChange, searchable = false, renderIcon }) {
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const searchRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState(null);
  const selected = options.find((option) => option.value === value);
  const matches = options.filter((option) =>
    `${option.label} ${option.searchText || ""}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );

  const focusOption = (direction = 1) => {
    const optionButtons = menuRef.current?.querySelectorAll('[role="option"]');
    if (!optionButtons?.length) return;
    const currentIndex = Array.from(optionButtons).indexOf(document.activeElement);
    const nextIndex = currentIndex < 0
      ? direction > 0 ? 0 : optionButtons.length - 1
      : (currentIndex + direction + optionButtons.length) % optionButtons.length;
    optionButtons[nextIndex].focus();
  };

  const handleTriggerKeyDown = (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) setOpen(true);
      window.requestAnimationFrame(() => focusOption(event.key === "ArrowUp" ? -1 : 1));
    }
  };

  const handleOptionKeyDown = (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      focusOption(event.key === "ArrowUp" ? -1 : 1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    }
  };

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.max(rect.width, searchable ? 252 : 142);
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
      const height = Math.min(320, searchable ? 316 : 260);
      const above = rect.bottom + height + 8 > window.innerHeight && rect.top > height;
      setPosition({ left, top: above ? rect.top - height - 4 : rect.bottom + 4, width });
    };
    const outside = (event) => {
      if (!triggerRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event) => { if (event.key === "Escape") setOpen(false); };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open, searchable]);

  useEffect(() => {
    if (open && searchable) searchRef.current?.focus();
    if (!open) setQuery("");
  }, [open, searchable]);

  return <>
    <button ref={triggerRef} type="button" className={`filter-dropdown-trigger${open ? " is-open" : ""}`} aria-label={label} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)} onKeyDown={handleTriggerKeyDown}>
      {selected?.code && renderIcon?.(selected)}
      <span>{selected?.label || label}</span>
      <CaretDown size={12} />
    </button>
    {open && position && createPortal(
      <div ref={menuRef} className="filter-dropdown-menu" style={position}>
        {searchable && <label className="filter-dropdown-search"><MagnifyingGlass size={15} /><input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => {
          if (event.key === "ArrowDown") { event.preventDefault(); focusOption(1); }
          else if (event.key === "Enter" && matches.length === 1) { onChange(matches[0].value); setOpen(false); }
        }} placeholder="输入国家或地区名称 / 代码" aria-label="搜索国家或地区" /></label>}
        <div className="filter-dropdown-options" role="listbox" aria-label={label}>
          {matches.length ? matches.map((option) => <button key={option.value} type="button" role="option" aria-selected={option.value === value} className={`filter-dropdown-option${option.value === value ? " is-selected" : ""}`} onKeyDown={handleOptionKeyDown} onClick={() => { onChange(option.value); setOpen(false); }}>
            {option.code && renderIcon?.(option)}<span>{option.label}</span>{option.code && <small>{option.code.toUpperCase()}</small>}
          </button>) : <div className="filter-dropdown-empty">未找到匹配的国家或地区</div>}
        </div>
        {searchable && <div className="filter-dropdown-foot">{matches.length} / {options.length} 个国家或地区</div>}
      </div>, document.body,
    )}
  </>;
}
