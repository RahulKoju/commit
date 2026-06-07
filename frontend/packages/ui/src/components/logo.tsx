import type { ImgHTMLAttributes } from "react"

type LogoProps = ImgHTMLAttributes<HTMLImageElement> & {
  size?: number
}

export function LogoMark({ size = 32, className, ...props }: LogoProps) {
  return (
    <img
      src="/logo.svg"
      alt="Commit"
      width={size}
      className={`-mx-0.5 ${className ?? ""}`}
      {...props}
    />
  )
}

export function Logo({ size = 32, className, ...props }: LogoProps) {
  return (
    <div className={`flex items-center gap-1 font-semibold ${className ?? ""}`}>
      <LogoMark size={size} {...props} />
      <span className="mt-1.5 text-[1.7rem] leading-none tracking-tight">
        Commit
      </span>
    </div>
  )
}
