import darkMark from '../assets/proxy-mark-dark.svg';
import lightMark from '../assets/proxy-mark-light.svg';

export default function ProxyMark({ size = 20, className = '', label = '' }) {
  return (
    <span
      className={`proxy-mark ${className}`}
      style={{ width: size, height: size }}
      role={label ? 'img' : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
    >
      <img className="proxy-mark-dark" src={darkMark} alt="" />
      <img className="proxy-mark-light" src={lightMark} alt="" />
    </span>
  );
}
