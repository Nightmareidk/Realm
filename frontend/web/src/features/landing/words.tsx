import { Fragment } from "react";
import styles from "./fun.module.css";

/**
 * Splits a heading into words, each inside its own mask, so they can rise into view one after
 * another as the heading scrolls in (scroll-fx.tsx). Screen readers read the text normally, and
 * without JavaScript it's simply the heading.
 */
export function Words({ children }: { children: string }) {
  const words = children.split(" ");
  return (
    <>
      {words.map((w, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a fixed heading split once; words can repeat and never reorder.
        <Fragment key={`${w}-${i}`}>
          <span className={styles.wordMask} data-word-mask="">
            <span className={styles.word} data-word="">
              {w}
            </span>
          </span>
          {i < words.length - 1 ? " " : ""}
        </Fragment>
      ))}
    </>
  );
}
