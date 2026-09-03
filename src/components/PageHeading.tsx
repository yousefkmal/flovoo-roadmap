/**
 * Title block. Two sizes, because the reference uses two: the board leads with
 * 24/700 over a 16px line, and the changelog with 30/600 over a 14px one.
 */
export function PageHeading({
  title,
  subtitle,
  size = "board",
}: {
  title: string;
  subtitle: string;
  size?: "board" | "changelog";
}) {
  const isChangelog = size === "changelog";

  return (
    <div className="max-w-2xl">
      <h1
        className={
          isChangelog
            ? "text-3xl/9 font-semibold text-text"
            : "text-2xl/8 font-bold text-text"
        }
      >
        {title}
      </h1>
      <p
        className={
          isChangelog
            ? "mt-2 text-sm/5 text-text-secondary"
            : "mt-1.5 text-base/6 text-text-secondary"
        }
      >
        {subtitle}
      </p>
    </div>
  );
}
