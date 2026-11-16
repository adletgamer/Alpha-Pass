/* eslint-disable @next/next/no-img-element */
export function Logo({ size = 36, withText = true }: { size?: number; withText?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <img src="/brand/alpha-pass-symbol.svg" width={Math.round(size * 1.22)} height={size} alt={withText ? "" : "Alpha Pass"} />
      {withText && (
        <span style={{ fontWeight: 800, fontSize: size * 0.62, color: "var(--ap-green-800)", letterSpacing: "-0.02em" }}>
          Alpha Pass
        </span>
      )}
    </span>
  );
}
