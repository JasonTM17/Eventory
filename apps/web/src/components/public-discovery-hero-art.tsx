export function PublicDiscoveryHeroArt(): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      className="public-discovery-hero-art"
      focusable="false"
      viewBox="0 0 460 392"
    >
      <path
        className="public-discovery-hero-art__ticket"
        d="M38 42H310V210C286 210 272 223 272 242C272 261 286 274 310 274V350H38V274C62 274 76 261 76 242C76 223 62 210 38 210V42Z"
      />
      <path className="public-discovery-hero-art__perforation" d="M76 94H272" />
      <path className="public-discovery-hero-art__perforation" d="M76 116H246" />
      <path className="public-discovery-hero-art__perforation" d="M76 138H218" />
      <text className="public-discovery-hero-art__label" x="76" y="185">
        EVENTORY / OPEN ROOM
      </text>
      <text className="public-discovery-hero-art__wordmark" x="72" y="258">
        E
      </text>
      <g className="public-discovery-hero-art__seat-map">
        <rect x="306" y="88" width="112" height="158" rx="6" />
        <path d="M328 117H396" />
        <path d="M328 139H396" />
        <path d="M328 161H396" />
        <path d="M328 183H396" />
        <path d="M350 106V202" />
        <path d="M374 106V202" />
        <circle cx="338" cy="128" r="5" />
        <circle cx="362" cy="150" r="5" />
        <circle cx="386" cy="172" r="5" />
        <circle cx="338" cy="194" r="5" />
      </g>
      <path className="public-discovery-hero-art__route" d="M322 305C350 279 385 287 410 314" />
      <circle className="public-discovery-hero-art__signal" cx="410" cy="314" r="14" />
      <text className="public-discovery-hero-art__route-label" x="302" y="348">
        FIND THE ROOM
      </text>
    </svg>
  );
}
