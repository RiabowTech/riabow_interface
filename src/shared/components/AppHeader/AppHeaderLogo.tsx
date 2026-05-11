import ButtonLink from "components/Button/ButtonLink";

import logoIcon from "img/home/logo.png";

export function AppHeaderLogo() {
  return (
    <ButtonLink to="/" className="flex items-center gap-8 px-6 py-4 text-typography-primary lg:hidden">
      <img src={logoIcon} alt="riabow Logo" className="logo-glow block h-24" />
      <span className="text-xl gold-gradient-text hidden font-bold tracking-wider md:block">riabow</span>
    </ButtonLink>
  );
}
