type Props = { variant?: 'sidebar' | 'mobile' | 'auth'; tagline?: boolean };

/** The supplied StrideEco artwork is shared across navigation and account pages. */
export default function Brand({ variant = 'sidebar', tagline = false }: Props) {
  return <span className={`brand-lockup brand-lockup-${variant}`}>
    <img className="brand-wordmark" src="/strideeco-logo.svg" alt="StrideEco" width={1049} height={211} fetchPriority="high"/>
    {tagline && <span className="brand-tagline">A little movement. A better day.</span>}
  </span>;
}
