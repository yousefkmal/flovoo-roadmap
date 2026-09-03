/**
 * Flovoo wordmark. The brand system allows the wordmark in gradient, Ink Navy
 * or white; this uses the gradient.
 *
 * No mark is drawn here on purpose — the system ships the chevron as an asset
 * (`flovoo-mark.svg`) and inventing a stand-in would put a wrong glyph in front
 * of customers. Drop the real file in and place it before the wordmark.
 */
export function FlovooLogo({ name }: { name: string }) {
  return (
    <span className="gradient-text text-xl font-extrabold tracking-tight">
      {name}
    </span>
  );
}
