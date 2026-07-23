import './globals.css';

const brands = ['LABTECH', 'GADGET', 'ACCESSORY', 'REPAIR', 'CORE'];

const cards = [
  {
    title: 'Screen Repair',
    description: 'Crisp displays restored with premium glass and fast service.',
    tag: 'Popular',
  },
  {
    title: 'Data Recovery',
    description: 'Recover lost files quickly from phones, drives, and PCs.',
    tag: 'Secure',
  },
  {
    title: 'Laptop Cleaning',
    description: 'Pro cleaning and thermal tuning for reliable performance.',
    tag: 'Pro',
  },
];

const repairFeatures = [
  { title: 'Quick, Safe Relocation', label: 'Repair', description: 'Secure transport and careful handling for every device.' },
  { title: 'Expert Diagnostics', label: 'Service', description: 'Identify issues fast with precision diagnostics.' },
  { title: 'Premium Repair', label: 'Quality', description: 'Top-grade components and expert craftsmanship.' },
  { title: 'Aftercare Support', label: 'Support', description: 'Follow-up support with warranties and guidance.' },
];

const sampleMaterials = [
  {
    icon: '🔬',
    title: 'Precision Microscope',
    description: 'High-magnification inspection for tiny components and board-level diagnostics.',
  },
  {
    icon: '📱',
    title: 'Phone Repair Kit',
    description: 'Expert tools for phones, screens, and battery swaps with premium care.',
  },
  {
    icon: '💻',
    title: 'Tablet & Laptop Parts',
    description: 'Quality replacement parts for tablets, laptops, and hybrid devices.',
  },
];

const milestoneItems = [
  { name: 'Expert Technicians', description: 'Certified experts working with the latest tools.' },
  { name: 'Satisfaction Guarantee', description: 'High-quality repairs backed by trust.' },
  { name: 'Transparent Pricing', description: 'Clear quotes with no surprise fees.' },
  { name: 'Broad Device Support', description: 'Phones, laptops, tablets, consoles, and more.' },
];

const reviews = [
  { name: 'Jordan Walker', quote: 'Amazing service, my phone looked brand new again.', rating: '5.0' },
  { name: 'Maya Patel', quote: 'Fast turnaround and friendly support every step of the way.', rating: '5.0' },
  { name: 'Noah Kim', quote: 'Reliable repairs with transparent pricing and fast delivery.', rating: '4.9' },
];

export default function HomePage() {
  return (
    <main className="page-wrap">
      <header className="hero-section">
        <div className="hero-nav">
          <div className="brand-logo">I-FixLab251</div>
          <nav className="nav-links">
            <a href="#services">Services</a>
            <a href="#repair">Repair</a>
            <a href="#milestone">About</a>
            <a href="#reviews">Reviews</a>
            <a href="#blog">Blog</a>
          </nav>
          <div className="hero-actions">
            <div className="language-select">
              <label htmlFor="language">ቋንቋ</label>
              <select id="language" name="language" defaultValue="en">
                <option value="en">EN</option>
                <option value="am">አማ</option>
              </select>
            </div>
            <a className="button tertiary" href="#contact">Track Repair</a>
            <a className="button primary" href="mailto:hello@gadgetrepair.example">Book a Call</a>
          </div>
        </div>

        <div className="hero-grid">
          <div className="hero-copy-panel">
            <p className="eyebrow">Gadget Repair</p>
            <h1>Bright Solutions for Dark Problems</h1>
            <p className="hero-copy">
              Premium device repair with expert technicians, fast delivery, and transparent service. Trust us to restore your gadgets with care.
            </p>
            <div className="hero-buttons">
              <a className="button primary" href="#services">Start Repair</a>
              <a className="button secondary" href="#milestone">Learn More</a>
            </div>
            <div className="hero-stats">
              <div>
                <strong>15+</strong>
                <span>Years experience</span>
              </div>
              <div>
                <strong>24h</strong>
                <span>Fast diagnostics</span>
              </div>
              <div>
                <strong>12m</strong>
                <span>Warranty</span>
              </div>
            </div>
          </div>

          <div className="hero-image-panel">
            <div className="hero-image-card">
              <div className="hero-tag">Trusted Repair</div>
              <div className="hero-image-content">
                <div className="hero-image-label">Professional device inspection</div>
                <div className="hero-image-meta">Premium treatment, fast turnaround.</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="brand-strip">
        {brands.map((brand) => (
          <span key={brand}>{brand}</span>
        ))}
      </section>

      <section id="services" className="section info-section">
        <div className="info-grid">
          <div className="info-copy">
            <p className="eyebrow">Your trusted partner for gadget repairs</p>
            <h2>Fast, accurate repairs with elite service and support.</h2>
            <p>
              We help customers across brands and device types with fast diagnostics, genuine parts, and premium service.
            </p>
          </div>
          <div className="info-cards">
            <article className="info-card">
              <h3>Device Repair</h3>
              <p>Screen replacement, battery upgrades, and precision repairs.</p>
            </article>
            <article className="info-card">
              <h3>Data Security</h3>
              <p>Safe retrieval and secure handling for damaged devices.</p>
            </article>
            <article className="info-card">
              <h3>Fast Delivery</h3>
              <p>Express service and same-day pickup options available.</p>
            </article>
          </div>
        </div>
      </section>

      <section id="repair" className="section feature-section">
        <div className="section-heading">
          <p className="eyebrow">Reliable Repairs</p>
          <h2>Explore our repair essentials.</h2>
        </div>
        <div className="feature-grid">
          {cards.map((card) => (
            <article key={card.title} className="feature-card">
              <div className="feature-lead">
                <span>{card.tag}</span>
                <h3>{card.title}</h3>
              </div>
              <p>{card.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section gallery-section">
        <div className="section-heading">
          <p className="eyebrow">Explore Our Repair Section</p>
          <h2>Solutions designed for every device.</h2>
        </div>
        <div className="gallery-grid">
          {repairFeatures.map((feature) => (
            <article key={feature.title} className="gallery-card">
              <div className="gallery-card-top">
                <span>{feature.label}</span>
              </div>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
              <a href="#contact" className="link-button">Request Service</a>
            </article>
          ))}
        </div>
      </section>

      <section className="section materials-section">
        <div className="section-heading">
          <p className="eyebrow">Repair Materials</p>
          <h2>Sample tools and devices we work with.</h2>
        </div>
        <div className="materials-grid">
          {sampleMaterials.map((material) => (
            <article key={material.title} className="material-card">
              <div className="material-icon">{material.icon}</div>
              <h3>{material.title}</h3>
              <p>{material.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="milestone" className="section milestone-section">
        <div className="milestone-grid">
          <div className="milestone-visual">
            <div className="milestone-banner">Ultimate Shield for Your Device</div>
            <div className="milestone-boxes">
              <div>Speaker Repair</div>
              <div>Battery & Power</div>
            </div>
          </div>
          <div className="milestone-copy">
            <p className="eyebrow">Achieved a milestone in repairing services</p>
            <h2>Expert craftsmanship, precise results.</h2>
            <div className="milestone-list">
              {milestoneItems.map((item) => (
                <div key={item.name} className="milestone-item">
                  <strong>{item.name}</strong>
                  <p>{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="reviews" className="section review-section">
        <div className="section-heading">
          <p className="eyebrow">Client Reviews</p>
          <h2>Customers love our premium repair experience.</h2>
        </div>
        <div className="review-grid">
          {reviews.map((review) => (
            <article key={review.name} className="review-card">
              <p>{review.quote}</p>
              <div className="review-meta">
                <strong>{review.name}</strong>
                <span>{review.rating} ★</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <footer className="site-footer">
        <div className="footer-top">
          <div>
            <div className="brand-logo footer-logo">WEFIX</div>
            <p>Premium gadget repair services with fast delivery and expert support.</p>
          </div>
          <div className="footer-links">
            <div>
              <strong>Services</strong>
              <a href="#services">Repairs</a>
              <a href="#repair">Diagnostics</a>
            </div>
            <div>
              <strong>Company</strong>
              <a href="#milestone">About</a>
              <a href="#contact">Contact</a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 WEFIX. All rights reserved.</span>
          <span>Designed for premium gadget owners.</span>
        </div>
      </footer>
    </main>
  );
}
