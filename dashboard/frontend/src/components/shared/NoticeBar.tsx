import { CheckCircle, XCircle, X } from 'lucide-react'
import { useOverviewData } from '../../hooks/useOverviewData'

export function NoticeBar() {
  const { notice, setNotice } = useOverviewData()
  if (!notice) return null

  return (
    <div className={`notice-bar notice-bar--${notice.type}`} role="status">
      {notice.type === 'success'
        ? <CheckCircle size={15} />
        : <XCircle size={15} />
      }
      <span>{notice.message}</span>
      <button className="notice-bar__close" onClick={() => setNotice(null)} aria-label="Dismiss">
        <X size={13} />
      </button>
    </div>
  )
}
