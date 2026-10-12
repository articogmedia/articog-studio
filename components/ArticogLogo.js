import Image from 'next/image';

export default function ArticogLogo({ className = '' }) {
  return (
    <Image
      aria-hidden="true"
      src="/articog-logo.png"
      alt=""
      width={44}
      height={44}
      priority
      className={`h-11 w-11 flex-shrink-0 object-contain ${className}`}
    />
  );
}