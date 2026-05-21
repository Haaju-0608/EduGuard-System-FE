import { NAV_LINKS } from '../../utils/constants';

export default function Navbar() {
  return (
    <nav
      className="fixed top-0 left-0 right-0 z-100 flex items-center justify-between px-[5vw] h-[68px] bg-[rgba(10,15,46,0.82)] backdrop-blur-[18px] border-b border-border"
    >
      {/* Logo */}
      <a href="#" className="flex items-center gap-[10px] font-syne font-extrabold text-[1.25rem] text-white-soft no-underline">
        <div className="w-[34px] h-[34px] bg-linear-to-br from-blue to-cyan rounded-[9px] grid place-items-center text-[1rem]">
          🛡️
        </div>
        EduGuard
      </a>

      {/* Nav Links */}
      <ul className="nav-links-responsive flex gap-[2.2rem] list-none">
        {NAV_LINKS.map((link) => (
          <li key={link.href}>
            <a
              href={link.href}
              className="text-muted no-underline text-[0.9rem] font-medium transition-colors duration-200 hover:text-white-soft"
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>

      {/* CTA Buttons */}
      <div className="flex gap-3 items-center">
        <button
          className="bg-transparent border border-border text-white-soft py-[0.45rem] px-[1.2rem] rounded-[8px] text-[0.88rem] cursor-pointer font-dm font-medium transition-all duration-200 hover:border-cyan hover:bg-cyan-glow"
        >
          Sign In
        </button>
        <button
          className="bg-linear-to-br from-blue to-cyan border-none text-white py-[0.5rem] px-[1.4rem] rounded-[8px] text-[0.88rem] cursor-pointer font-dm font-semibold shadow-[0_0_22px_rgba(37,99,235,0.5)] transition-all duration-200 hover:shadow-[0_0_36px_rgba(6,182,212,0.55)] hover:-translate-y-[1px]"
        >
          Contact Us
        </button>
      </div>
    </nav>
  );
}
