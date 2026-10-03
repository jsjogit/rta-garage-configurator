import { CART_URL } from '../api/client'

const HEADINGS: Record<string, string> = {
  TallsNeedTipUpRoom: 'Why there are no pantries here',
  TallsExcludedLowCeiling: 'What fits under this ceiling',
  ObstructionsWorthADesignerLook: 'Worth a second opinion',
}

export function Notices({ notices }: { notices: { code: string; message: string }[] }) {
  if (notices.length === 0) return null

  return (
    <div>
      {notices.map((notice) => (
        <aside className="notice" key={notice.code}>
          <h3>{HEADINGS[notice.code] ?? 'Worth knowing'}</h3>
          <p>
            {notice.message}{' '}
            <a href={`${CART_URL.replace('/cart', '')}/contactus`}>Talk to a designer</a>.
          </p>
        </aside>
      ))}
    </div>
  )
}
