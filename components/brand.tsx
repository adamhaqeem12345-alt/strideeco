type Props = { variant?: 'sidebar' | 'mobile' | 'auth'; tagline?: boolean };

/** The selected StrideEco wordmark is shared across navigation and account pages. */
export default function Brand({ variant = 'sidebar', tagline = false }: Props) {
  return <span className={`brand-lockup brand-lockup-${variant}`}>
    <img className="brand-wordmark" src="/strideeco-wordmark.png?v=se-wordmark-20261023" alt="StrideEco" width={1810} height={354} fetchPriority="high"/>
    {tagline && <span className="brand-tagline">A little movement. A better day.</span>}
  </span>;
}
