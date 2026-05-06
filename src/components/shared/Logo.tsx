type LogoVariant = 'mark' | 'full';

type LogoProps = {
  variant?: LogoVariant;
  size?: number;
  className?: string;
  alt?: string;
};

type LogoWordmarkProps = LogoProps & {
  label?: string;
  labelClassName?: string;
};

const logoSources: Record<LogoVariant, string> = {
  mark: '/snaplex-mascot.png',
  full: '/snaplex-mascot-full.png',
};

export const Logo = ({
  variant = 'mark',
  size = 32,
  className = '',
  alt = 'Snaplex',
}: LogoProps) => (
  <img
    src={logoSources[variant]}
    alt={alt}
    width={size}
    height={size}
    className={`shrink-0 object-contain ${className}`.trim()}
    style={{ width: size, height: size }}
    decoding="async"
  />
);

export const LogoWordmark = ({
  label = 'Snaplex',
  labelClassName = '',
  alt = '',
  ...logoProps
}: LogoWordmarkProps) => (
  <span className="inline-flex items-center gap-2">
    <Logo {...logoProps} alt={alt} />
    <span className={labelClassName}>{label}</span>
  </span>
);

export default Logo;
