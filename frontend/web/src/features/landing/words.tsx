import type { CSSProperties } from "react";
import styles from "./fun.module.css";

/**
 * Splits a heading into words that rise in one after another as it scrolls into view
 * (scroll-driven, no JS). Screen readers read the text normally.
 */
export function Words({ children }: { children: string }) {
  const words = children.split(" ");
  return (
    <>
      {words.map((w, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a fixed heading split once; words can repeat and never reorder.
        <span key={`${w}-${i}`} className={styles.word} style={{ "--i": i } as CSSProperties}>
          {w}
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </>
  );
}
