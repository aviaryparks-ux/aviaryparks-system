// components/DropdownMenu.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type DropdownItem = {
  name: string;
  path: string;
  icon?: React.ReactNode;
  onClick?: () => void;
};

type DropdownMenuProps = {
  trigger: React.ReactNode;
  items: DropdownItem[];
  align?: "left" | "right";
  width?: number;
  onOpenChange?: (isOpen: boolean) => void;
};

export default function DropdownMenu({
  trigger,
  items,
  align = "left",
  width = 240,
  onOpenChange,
}: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const toggleDropdown = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    onOpenChange?.(newState);
  };

  const closeDropdown = () => {
    setIsOpen(false);
    onOpenChange?.(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        closeDropdown();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        closeDropdown();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <div onClick={toggleDropdown} className="cursor-pointer">
        {trigger}
      </div>

      {/* Dropdown Menu - tanpa backdrop global di sini */}
      {isOpen && (
        <div
          className={`
            absolute z-50 mt-2 bg-white/95 backdrop-blur-xl rounded-xl shadow-2xl
            border border-white/20 overflow-hidden animate-dropdown
            ${align === "left" ? "left-0" : "right-0"}
          `}
          style={{ width }}
        >
          <div className="py-2">
            {items.map((item, index) => {
              const isActive = item.path && pathname === item.path;
              
              if (item.onClick) {
                return (
                  <button
                    key={index}
                    onClick={() => {
                      item.onClick?.();
                      closeDropdown();
                    }}
                    className={`
                      w-full flex items-center gap-3 px-4 py-2.5 text-sm
                      transition-colors duration-150
                      hover:bg-gray-100/80
                      text-gray-700
                    `}
                  >
                    {item.icon && <span className="w-4 h-4 text-gray-400">{item.icon}</span>}
                    {item.name}
                  </button>
                );
              }

              return (
                <Link
                  key={index}
                  href={item.path}
                  onClick={closeDropdown}
                  className={`
                    flex items-center gap-3 px-4 py-2.5 text-sm
                    transition-colors duration-150
                    ${isActive
                      ? "bg-green-50 text-green-700"
                      : "text-gray-700 hover:bg-gray-100/80"
                    }
                  `}
                >
                  {item.icon && (
                    <span className={`w-4 h-4 ${isActive ? "text-green-600" : "text-gray-400"}`}>
                      {item.icon}
                    </span>
                  )}
                  {item.name}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes dropdownFadeIn {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-dropdown {
          animation: dropdownFadeIn 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}