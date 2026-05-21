const footerLinks = {
  product: {
    title: 'Products',
    links: ['Smart Attendance', 'Live Proctoring', 'Analytics', 'Mobile App'],
  },
  company: {
    title: 'Company',
    links: ['About Us', 'Blog', 'Careers', 'Contact'],
  },
  support: {
    title: 'Support',
    links: ['Documentation', 'API Docs', 'Status', 'Privacy Policy'],
  },
};

export default function Footer() {
  return (
    <footer className="relative bg-navy pt-16 pb-8 px-6 border-t border-border">
      <div className="max-w-[1200px] mx-auto">
        {/* 4-column grid */}
        <div className="grid grid-cols-4 gap-10 mb-14 footer-responsive">
          {/* Column 1 — Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue to-cyan flex items-center justify-center text-white font-bold text-sm">
                E
              </div>
              <span className="font-syne font-bold text-lg text-white-soft">EduGuard</span>
            </div>
            <p className="text-muted text-sm leading-relaxed">
              Comprehensive AI platform for education — smart attendance, exam proctoring, and data analytics.
            </p>
          </div>

          {/* Column 2 — Products */}
          <div>
            <h4 className="font-syne font-bold text-white-soft text-sm mb-4">{footerLinks.product.title}</h4>
            <ul className="flex flex-col gap-2.5">
              {footerLinks.product.links.map((link, i) => (
                <li key={i}>
                  <a href="#" className="text-muted text-sm hover:text-cyan transition-colors duration-200">
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3 — Company */}
          <div>
            <h4 className="font-syne font-bold text-white-soft text-sm mb-4">{footerLinks.company.title}</h4>
            <ul className="flex flex-col gap-2.5">
              {footerLinks.company.links.map((link, i) => (
                <li key={i}>
                  <a href="#" className="text-muted text-sm hover:text-cyan transition-colors duration-200">
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4 — Support */}
          <div>
            <h4 className="font-syne font-bold text-white-soft text-sm mb-4">{footerLinks.support.title}</h4>
            <ul className="flex flex-col gap-2.5">
              {footerLinks.support.links.map((link, i) => (
                <li key={i}>
                  <a href="#" className="text-muted text-sm hover:text-cyan transition-colors duration-200">
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-border pt-6 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-muted text-sm">
            © 2024 EduGuard. All rights reserved.
          </p>
          <p className="text-cyan text-sm">
            Powered by AI · Built for Education
          </p>
        </div>
      </div>
    </footer>
  );
}
