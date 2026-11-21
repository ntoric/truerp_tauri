import Link from 'next/link'
import { ArrowRight, Check, ChevronDown, Headset, Menu, MonitorSmartphone } from 'lucide-react'
import './landing.css'
import { BrowserFrame } from './BrowserFrame'
import ProductShowcase from './ProductShowcase'
import {
  FACTS,
  FAQS,
  FEATURES,
  INDUSTRIES,
  NAV,
  PAYMENT_MODES,
  PLANS,
  PLATFORM,
  STEPS,
  SUPPORT_CHANNELS,
  WIDGETS,
} from './content'

// Gooseroot iconography: line icons, 1.8px stroke.
const STROKE = 1.8

function Logo() {
  return (
    <span className="lp-logo" role="img" aria-label="TruERP">
      <img src="/logo.svg" alt="" aria-hidden="true" width={36} height={36} />
      <span aria-hidden="true">
        Tru<b>ERP</b>
      </span>
    </span>
  )
}

function SectionHead({ eyebrow, title, body }: { eyebrow: string; title: string; body?: string }) {
  return (
    <div className="lp-head">
      <p className="lp-overline">{eyebrow}</p>
      <h2 className="lp-h1">{title}</h2>
      {body && <p className="lp-lead">{body}</p>}
    </div>
  )
}

export default function LandingPage() {
  return (
    <div className="landing-root">
      {/* ── Navbar (gr-nav) ── */}
      <header className="lp-navwrap">
        <div className="lp-container">
          <div className="lp-nav">
            <Link href="/" aria-label="TruERP home">
              <Logo />
            </Link>
            <nav className="lp-nav__links" aria-label="Main">
              {NAV.map((n) => (
                <a key={n.href} href={n.href} className="lp-nav__link">
                  {n.label}
                </a>
              ))}
            </nav>
            <div className="lp-nav__actions">
              <Link href="/login" className="lp-btn lp-btn--ghost">
                Sign in
              </Link>
              <a href="#contact" className="lp-btn lp-btn--primary">
                Contact support
              </a>
              <details className="lp-nav__toggle">
                <summary className="lp-btn lp-btn--secondary lp-btn--sm" aria-label="Open menu">
                  <Menu strokeWidth={STROKE} />
                </summary>
                <div className="lp-nav__menu">
                  {NAV.map((n) => (
                    <a key={n.href} href={n.href} className="lp-nav__link">
                      {n.label}
                    </a>
                  ))}
                  <Link href="/login" className="lp-nav__link">
                    Sign in
                  </Link>
                  <a href="#contact" className="lp-btn lp-btn--primary lp-btn--block" style={{ marginTop: 8 }}>
                    Contact support
                  </a>
                </div>
              </details>
            </div>
          </div>
        </div>
      </header>

      <main>
        {/* ── Hero ── */}
        <section className="lp-hero">
          <div className="lp-container">
            <div className="lp-hero__copy">
              <span className="lp-badge lp-badge--red">GST-ready billing, POS & accounting for Indian businesses</span>
              <h1 className="lp-display">
                Billing, stock and accounts in one <span className="lp-grad-text">place</span>.
              </h1>
              <p className="lp-lead">
                TruERP lets you create GST invoices, run a fast POS counter, track inventory, pay your staff and keep your books
                CA-ready, without spreadsheets or a server in the back room.
              </p>
              <div className="lp-hero__ctas">
                <a href="#contact" className="lp-btn lp-btn--primary lp-btn--lg">
                  Contact support to get started <ArrowRight strokeWidth={STROKE} />
                </a>
                <a href="#product" className="lp-btn lp-btn--secondary lp-btn--lg">
                  Take the product tour
                </a>
              </div>
              <ul className="lp-hero__points">
                {['Guided setup by our team', 'Free data import', 'Support on WhatsApp & phone'].map((t) => (
                  <li key={t}>
                    <Check strokeWidth={2.4} /> {t}
                  </li>
                ))}
              </ul>
            </div>

            <div className="lp-hero__visual">
              <BrowserFrame url="truerp.co.in/dashboard">
                <img
                  src="/landing/dashboard.jpg"
                  alt="TruERP dashboard showing sales, collections and top products"
                  width={1600}
                  height={1000}
                  fetchPriority="high"
                />
              </BrowserFrame>
              <div className="lp-float lp-float--tr">
                <img src="/landing/widget-invoice-status.jpg" alt="Invoice status chart" width={800} height={635} />
              </div>
              <div className="lp-float lp-float--bl">
                <img src="/landing/widget-payment-modes.jpg" alt="Payment modes chart" width={800} height={576} />
              </div>
            </div>
          </div>
        </section>

        {/* ── Facts + payment modes ── */}
        <section className="lp-container">
          <div className="lp-card" style={{ padding: '32px 32px 28px' }}>
            <dl className="lp-facts lp-center" style={{ margin: 0 }}>
              {FACTS.map((f) => (
                <div key={f.label}>
                  <dt className="lp-fact__value">{f.value}</dt>
                  <dd className="lp-fact__label" style={{ marginInline: 0 }}>
                    {f.label}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="lp-facts__pay">
              <span className="lp-overline" style={{ color: 'var(--lp-muted)' }}>
                Accept every way India pays
              </span>
              <ul className="lp-chips">
                {PAYMENT_MODES.map((m) => (
                  <li key={m} className="lp-badge lp-badge--neutral">
                    {m}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section id="features" className="lp-section">
          <div className="lp-container">
            <SectionHead
              eyebrow="Everything you need"
              title="One app to run your whole business"
              body="Stop switching between a billing app, a stock register and an accounting package. Turn on the modules you need and add more as you grow."
            />
            <div className="lp-grid lp-cols-3" style={{ marginTop: 48 }}>
              {FEATURES.map(({ icon: Icon, title, body }, i) => (
                <div key={title} className="lp-card lp-card--lift lp-feature">
                  <span className={`lp-well${i === 0 ? ' lp-well--brand' : ''}`}>
                    <Icon strokeWidth={STROKE} />
                  </span>
                  <h3 className="lp-h3">{title}</h3>
                  <p className="lp-body">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Product tour ── */}
        <section id="product" className="lp-container">
          <div className="lp-shell">
            <SectionHead
              eyebrow="Product tour"
              title="Built around how Indian businesses actually work"
              body="From the cashier at the counter to the owner checking numbers at night, every screen is designed for speed and clarity."
            />
            <div style={{ marginTop: 36 }}>
              <ProductShowcase />
            </div>
          </div>
        </section>

        {/* ── Dashboard widgets ── */}
        <section className="lp-section">
          <div className="lp-container">
            <SectionHead
              eyebrow="Live insights"
              title="A dashboard that thinks like an owner"
              body="Don’t wait for month-end reports. Every panel updates the moment a bill is created at any counter."
            />
            <div className="lp-grid lp-cols-4" style={{ marginTop: 48 }}>
              {WIDGETS.map((w) => (
                <figure key={w.title} className={`lp-card lp-card--lift lp-widget${w.wide ? ' lp-span-2' : ''}`}>
                  <img src={w.img} alt={`${w.title} widget`} loading="lazy" />
                  <figcaption>
                    <p className="lp-h3" style={{ fontSize: 16 }}>
                      {w.title}
                    </p>
                    <p className="lp-body" style={{ marginTop: 2 }}>
                      {w.body}
                    </p>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* ── Industries ── */}
        <section id="industries" className="lp-container">
          <div className="lp-shell">
            <SectionHead
              eyebrow="Made for your trade"
              title="Fits the way your business works"
              body="Retailers, wholesalers, pharmacies and chains each get the tools that matter to them."
            />
            <ul className="lp-grid lp-cols-4" style={{ marginTop: 48, padding: 0, listStyle: 'none' }}>
              {INDUSTRIES.map(({ icon: Icon, name, note }) => (
                <li key={name} className="lp-industry" style={{ background: 'var(--lp-surface-2)', border: '1px solid var(--lp-line)' }}>
                  <span className="lp-well lp-well--sm">
                    <Icon strokeWidth={STROKE} />
                  </span>
                  <div>
                    <p className="lp-h3">{name}</p>
                    <p className="lp-caption" style={{ marginTop: 4 }}>
                      {note}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── Platform ── */}
        <section className="lp-section">
          <div className="lp-container lp-split">
            <div>
              <p className="lp-overline">Anywhere, any device</p>
              <h2 className="lp-h1" style={{ marginTop: 12 }}>
                Cloud convenience with counter-grade reliability
              </h2>
              <p className="lp-lead" style={{ marginTop: 14 }}>
                Use TruERP in the browser, or install the desktop app on your billing counters. Either way your data is backed up,
                secure and in sync.
              </p>
              <div className="lp-platform">
                {PLATFORM.map(({ icon: Icon, title, body }) => (
                  <div key={title}>
                    <span className="lp-well lp-well--sm">
                      <Icon strokeWidth={STROKE} />
                    </span>
                    <h3 className="lp-h3">{title}</h3>
                    <p className="lp-body">{body}</p>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ position: 'relative' }}>
              <BrowserFrame url="TruERP for macOS · dark mode">
                <img src="/landing/dashboard-dark.jpg" alt="TruERP dashboard in dark mode" loading="lazy" width={1600} height={1022} />
              </BrowserFrame>
              <div className="lp-pill-note">
                <span className="lp-well lp-well--sm">
                  <MonitorSmartphone strokeWidth={STROKE} />
                </span>
                <div>
                  <p className="lp-h3" style={{ fontSize: 14, lineHeight: '20px' }}>
                    Web · macOS · Windows
                  </p>
                  <p className="lp-caption">One account, every device</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── How it works (gr-steps) ── */}
        <section className="lp-container">
          <div className="lp-shell">
            <SectionHead
              eyebrow="Easy switch"
              title="Live across your counters in 24 hours"
              body="No installation, no IT team. Bring your existing data and start billing right away."
            />
            <ol className="lp-steps">
              {STEPS.map((s, i) => (
                <li key={s.n} className="lp-step">
                  <span className="lp-step__dot">{i + 1}</span>
                  <h3 className="lp-h3">{s.title}</h3>
                  <p className="lp-body">{s.body}</p>
                  <span className="lp-badge lp-badge--red">{s.when}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Pricing (gr-price) ── */}
        <section id="pricing" className="lp-section">
          <div className="lp-container">
            <SectionHead
              eyebrow="Pricing"
              title="Simple, transparent pricing"
              body="One plan with everything included, or a custom setup built around your business. Hosting, backups, GST updates and support always included."
            />
            <div className="lp-pricing">
              {PLANS.map((p) => (
                <div key={p.name} className={`lp-card lp-price${p.popular ? ' is-featured' : ''}`}>
                  {p.popular && <span className="lp-badge lp-badge--onbrand" style={{ alignSelf: 'flex-start' }}>Most popular</span>}
                  <div>
                    <h3 className="lp-h2">{p.name}</h3>
                    <p className="lp-body" style={{ marginTop: 4 }}>
                      {p.tagline}
                    </p>
                  </div>
                  <div>
                    <div className="lp-price__amount">
                      {p.price ? (
                        <>
                          ₹{p.price} <small>{p.period}</small>
                        </>
                      ) : (
                        <>Let’s talk</>
                      )}
                    </div>
                    <p className="lp-caption" style={{ marginTop: 4 }}>
                      {p.note}
                    </p>
                  </div>
                  <ul>
                    {p.features.map((f) =>
                      f.endsWith(':') ? (
                        <li key={f} className="lp-price__group">
                          {f}
                        </li>
                      ) : (
                        <li key={f}>
                          <Check className="lp-check" strokeWidth={2.4} />
                          {f}
                        </li>
                      ),
                    )}
                  </ul>
                  <a href="#contact" className={`lp-btn lp-btn--block ${p.popular ? 'lp-btn--white' : 'lp-btn--secondary'}`}>
                    {p.cta}
                  </a>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section id="faq" className="lp-container" style={{ paddingBottom: 72 }}>
          <SectionHead eyebrow="FAQ" title="Questions, answered" />
          <div className="lp-faq">
            {FAQS.map((f) => (
              <details key={f.q}>
                <summary>
                  {f.q}
                  <ChevronDown strokeWidth={STROKE} />
                </summary>
                <p className="lp-body">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ── Contact support (brand card) ── */}
        <section id="contact" className="lp-container">
          <div className="lp-brandcard">
            <img className="lp-brandcard__mark" src="/brand/gooseroot-symbol-white-transparent.svg" alt="" aria-hidden="true" />
            <Headset strokeWidth={STROKE} style={{ width: 32, height: 32, margin: '0 auto', opacity: 0.9 }} />
            <p className="lp-overline" style={{ marginTop: 14 }}>
              Get started
            </p>
            <h2 className="lp-h1">Ready to simplify your billing?</h2>
            <p className="lp-lead">
              TruERP accounts are set up by our support team. Get in touch and we’ll create your workspace, import your data and
              have you billing quickly.
            </p>
            {SUPPORT_CHANNELS.length > 0 && (
              <ul className="lp-contact">
                {SUPPORT_CHANNELS.map(({ icon: Icon, label, value, href }) => (
                  <li key={label}>
                    <a
                      href={href}
                      target={href.startsWith('http') ? '_blank' : undefined}
                      rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
                    >
                      <Icon strokeWidth={STROKE} />
                      <small>{label}</small>
                      <strong>{value}</strong>
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <div className="lp-brandcard__ctas">
              {SUPPORT_CHANNELS[0] && (
                <a href={SUPPORT_CHANNELS[0].href} className="lp-btn lp-btn--white lp-btn--lg">
                  Contact support <ArrowRight strokeWidth={STROKE} />
                </a>
              )}
              <Link href="/login" className="lp-btn lp-btn--onbrand lp-btn--lg">
                Sign in to your account
              </Link>
            </div>
            <p className="lp-brandcard__note">Guided setup · Free data import · Support on call</p>
          </div>
        </section>
      </main>

      {/* ── Footer (gr-footer) ── */}
      <footer className="lp-footer">
        <div className="lp-container">
          <div className="lp-footer__grid">
            <div className="lp-footer__brand">
              <Logo />
              <p>GST billing, POS, inventory, HR and accounting software for Indian businesses.</p>
              <span className="lp-footer__by">
                A product by <img src="/brand/gooseroot-logo-white.svg" alt="Gooseroot" />
              </span>
            </div>
            <FooterCol
              title="Product"
              links={[
                ['#features', 'Features'],
                ['#product', 'Product tour'],
                ['#pricing', 'Pricing'],
                ['#faq', 'FAQ'],
              ]}
            />
            <FooterCol
              title="Solutions"
              links={[
                ['#industries', 'Retail & grocery'],
                ['#industries', 'Wholesale & distribution'],
                ['#industries', 'Pharmacy'],
                ['#industries', 'Multi-outlet chains'],
              ]}
            />
            <FooterCol
              title="Account"
              links={[
                ['#contact', 'Contact support'],
                ['/login', 'Sign in'],
                ['/forgot-password', 'Reset password'],
              ]}
            />
          </div>
          <div className="lp-footer__bottom">
            <span>© {new Date().getFullYear()} TruERP by Gooseroot. All rights reserved.</span>
            <span>Made in India, for Indian businesses</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h4>{title}</h4>
      <ul>
        {links.map(([href, label]) => (
          <li key={label}>{href.startsWith('#') ? <a href={href}>{label}</a> : <Link href={href}>{label}</Link>}</li>
        ))}
      </ul>
    </div>
  )
}
