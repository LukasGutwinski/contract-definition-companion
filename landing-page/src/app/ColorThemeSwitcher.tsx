"use client";

import { Check, ChevronDown, Palette } from "lucide-react";
import { useEffect, useState } from "react";
import styles from "./page.module.css";

const storageKey = "contract-definitions-color-theme";

const themes = [
  {
    id: "original",
    label: "Original",
    description: "Blue, teal & orange",
    colors: ["#145cc7", "#153f3c", "#ef5b23"],
  },
  {
    id: "cool-blue",
    label: "Cool Blue",
    description: "Quiet & product-led",
    colors: ["#2767d8", "#1b4772", "#37a6c4"],
  },
  {
    id: "gut-navy",
    label: "GUT Navy",
    description: "Navy & cyan",
    colors: ["#0b5d78", "#020a2f", "#47d3f2"],
  },
  {
    id: "bordeaux",
    label: "Bordeaux",
    description: "Warm & editorial",
    colors: ["#8f2945", "#493047", "#c8815c"],
  },
  {
    id: "forest",
    label: "Forest",
    description: "Natural & grounded",
    colors: ["#2d6a4f", "#1e4033", "#d59f24"],
  },
  {
    id: "monochrome",
    label: "Monochrome",
    description: "Reduced & typographic",
    colors: ["#30302f", "#171716", "#85847f"],
  },
] as const;

type ThemeId = (typeof themes)[number]["id"];

function isThemeId(value: string | null): value is ThemeId {
  return themes.some((theme) => theme.id === value);
}

export function ColorThemeSwitcher() {
  const [activeTheme, setActiveTheme] = useState<ThemeId>("original");
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(storageKey);

    if (isThemeId(savedTheme)) {
      setActiveTheme(savedTheme);
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.landingTheme = activeTheme;
    window.localStorage.setItem(storageKey, activeTheme);

    return () => {
      delete document.documentElement.dataset.landingTheme;
    };
  }, [activeTheme]);

  const currentTheme =
    themes.find((theme) => theme.id === activeTheme) ?? themes[0];

  return (
    <aside className={styles.colorLab} aria-label="Temporary color theme switcher">
      <button
        className={styles.colorLabToggle}
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span>
          <Palette aria-hidden="true" size={17} strokeWidth={1.8} />
          Color Lab
        </span>
        <span className={styles.colorLabCurrent}>{currentTheme.label}</span>
        <ChevronDown
          className={isOpen ? styles.colorLabChevronOpen : undefined}
          aria-hidden="true"
          size={16}
        />
      </button>

      {isOpen ? (
        <div className={styles.colorLabPanel}>
          <p>Temporary palette preview</p>
          <div className={styles.colorThemeGrid} role="group" aria-label="Color themes">
            {themes.map((theme) => {
              const isActive = theme.id === activeTheme;

              return (
                <button
                  key={theme.id}
                  type="button"
                  className={isActive ? styles.colorThemeActive : undefined}
                  aria-pressed={isActive}
                  onClick={() => setActiveTheme(theme.id)}
                >
                  <span className={styles.colorSwatches} aria-hidden="true">
                    {theme.colors.map((color) => (
                      <span key={color} style={{ backgroundColor: color }} />
                    ))}
                  </span>
                  <span className={styles.colorThemeCopy}>
                    <strong>{theme.label}</strong>
                    <small>{theme.description}</small>
                  </span>
                  {isActive ? (
                    <Check
                      className={styles.colorThemeCheck}
                      aria-hidden="true"
                      size={15}
                      strokeWidth={2}
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </aside>
  );
}
