const KNOWN_EMOJIS = new Set([
  "alert","angel","angry","apps-colorful","apps-green","apps-letters","backup","blocks","calendar",
  "camera","camera-lens","chef","clipboard","cloud-upload","code-terminal","cooking-phone","cool",
  "cowboy","crying","cubes-small","database","database-group","delivery","devil","doc-check",
  "doc-search","download","editor","email","fire","fishing","frying","gamer","gaming","gardening",
  "ghost","happy","hourglass","laptop","laughing","lazy","love","meditating","money","music","ninja",
  "numbers","package","packing","painting","party","pipeline","pirate","pizza","reading","robot",
  "rocket","satellite","search","settings-gear","shopping","sick","sleeping","sleepy","smile-small",
  "smirk","spider","sports","starry","surprised","sync","sync-green","tag-camera","target-orange",
  "unbox","video-search","web-scraper","weightlifting","wizard","writing"
]);

export { KNOWN_EMOJIS };

export default function BotEmoji({ emoji, name, size = 48 }) {
  if (emoji && KNOWN_EMOJIS.has(emoji)) {
    return (
      <img
        src={`/emojis/${emoji}.png`}
        alt={emoji}
        style={{
          width: size,
          height: size,
          objectFit: 'contain',
          borderRadius: size * 0.2,
        }}
      />
    );
  }

  if (emoji && /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}]/u.test(emoji)) {
    return (
      <span style={{ fontSize: size * 0.7, lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size }}>
        {emoji}
      </span>
    );
  }

  const letter = (name || emoji || '?')[0].toUpperCase();
  return (
    <span style={{
      width: size, height: size, borderRadius: size * 0.28,
      background: 'var(--accent-soft)',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.4, fontWeight: 700, color: 'var(--accent)', flexShrink: 0,
    }}>{letter}</span>
  );
}
