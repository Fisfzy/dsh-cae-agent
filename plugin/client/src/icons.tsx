/**
 * Inline SVG icons — no icon-font dependency, currentColor so they inherit
 * the theme token of wherever they render.
 */

interface IconProps {
  size?: number
}

function base(path: string, size = 14, extra?: JSX.SVGAttributes<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...extra}
    >
      <path d={path} />
    </svg>
  )
}

export const IconCopy = ({ size }: IconProps) =>
  base('M5 3h8v9H5z M3 6H2v7h8v-1', size)

export const IconCheck = ({ size }: IconProps) => base('M3 8.5l3.2 3.2L13 5', size)

export const IconChevron = ({ size }: IconProps) => base('M5 3l5 5-5 5', size)

export const IconSearch = ({ size }: IconProps) =>
  base('M7 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10z M11 11l3.5 3.5', size)

export const IconRefresh = ({ size }: IconProps) =>
  base('M13.5 8a5.5 5.5 0 1 1-1.6-3.9 M13.5 2v3h-3', size)

export const IconFolder = ({ size }: IconProps) =>
  base('M2 4h4l1.5 1.5H14V13H2z', size)

export const IconDot = ({ size }: IconProps) =>
  base('M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', size)
