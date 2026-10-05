import { coverUrl } from '@/lib/products'

export default function Cover({
  path, alt = '', style,
}: { path?: string | null; alt?: string; style?: React.CSSProperties }) {
  const url = coverUrl(path)
  if (!url) return <div className="thumb" style={style} />
  return (
    <div className="thumb" style={{ overflow: 'hidden', ...style }}>
      <img src={url} alt={alt} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
    </div>
  )
}