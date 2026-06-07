import type { ImgHTMLAttributes } from "react"

type LogoProps = ImgHTMLAttributes<HTMLImageElement> & {
  size?: number
}

export function LogoMark({ size = 40, className, ...props }: LogoProps) {
  return (
    <img
      src="/logo.svg"
      alt="Commit"
      width={size}
      className={className}
      {...props}
    />
  )
}

export function Logo({ size = 40, className, ...props }: LogoProps) {
  return (
    <div className={`flex items-center gap-3 font-medium ${className ?? ""}`}>
      <LogoMark size={size} {...props} />
      <span className="text-lg">Commit</span>
    </div>
  )
}
