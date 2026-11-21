export function BrowserFrame({ url, children }: { url: string; children: React.ReactNode }) {
  return (
    <div className="lp-frame">
      <div className="lp-frame__bar">
        {/* Neutral dots: the brand palette has no yellow/green. */}
        <div className="lp-frame__dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="lp-frame__url">{url}</div>
      </div>
      {children}
    </div>
  )
}
