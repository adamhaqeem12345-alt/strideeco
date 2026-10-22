export default function WaterBottle({ small = false }: { small?: boolean }) {
  return <svg className={small ? 'bottle-small' : 'bottle-art'} viewBox="0 0 150 235" role="img" aria-label="Illustration of a bottle of drinking water">
    <defs><linearGradient id="bottle-glass" x1="0" x2="1"><stop offset="0" stopColor="#d7f0ed"/><stop offset=".45" stopColor="#f4ffff"/><stop offset="1" stopColor="#b8dfdf"/></linearGradient><linearGradient id="bottle-water" x1="0" x2="1"><stop stopColor="#42c3fe"/><stop offset=".5" stopColor="#b8f5fa"/><stop offset="1" stopColor="#34afab"/></linearGradient></defs>
    <ellipse cx="77" cy="222" rx="42" ry="7" fill="#087c80" opacity=".12"/>
    <path d="M56 37H94V57C94 69 111 72 111 91V207Q111 220 99 220H51Q39 220 39 207V91C39 72 56 69 56 57Z" fill="url(#bottle-glass)" stroke="#9bc4c3" strokeWidth="1.5"/>
    <path d="M42 105Q75 115 108 104V204Q108 216 97 216H53Q42 216 42 204Z" fill="url(#bottle-water)" opacity=".8"/>
    <rect x="53" y="22" width="44" height="21" rx="5" fill="#087c80"/>
    <path d="M59 25V40M65 25V40M71 25V40M77 25V40M83 25V40M89 25V40" stroke="#34afab" strokeWidth="1"/>
    <path d="M46 86Q52 75 58 72M46 97V133" fill="none" stroke="white" strokeOpacity=".9" strokeWidth="4" strokeLinecap="round"/>
    <rect x="39" y="137" width="72" height="49" rx="3" fill="#ffffff"/>
    <path d="M68 159Q77 142 86 159Q88 171 76 172Q65 170 68 159" fill="#087c80"/>
    <text x="75" y="181" textAnchor="middle" fontFamily="Arial,sans-serif" fontSize="6" letterSpacing="2" fill="#0c343c">DRINKING WATER</text>
    <path d="M46 119H104M46 126H104M46 196H104M46 203H104" stroke="#94c2c4" strokeWidth="1.6" opacity=".7"/>
  </svg>;
}
