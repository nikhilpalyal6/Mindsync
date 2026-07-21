import { useEffect, useState } from 'react'

const eventKey = 'mindsync-toast'

export default function Toast() {
  const [message, setMessage] = useState('')
  const [type, setType] = useState('success')
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const handleToast = (event) => {
      if (!event.detail) return
      setMessage(event.detail.message)
      setType(event.detail.type || 'success')
      setVisible(true)
      window.setTimeout(() => setVisible(false), 4000)
    }

    window.addEventListener(eventKey, handleToast)
    return () => window.removeEventListener(eventKey, handleToast)
  }, [])

  if (!visible) return null

  return (
    <div className={`toast toast-${type}`}>
      <div>{message}</div>
    </div>
  )
}

export const showToast = (message, type = 'success') => {
  window.dispatchEvent(new CustomEvent(eventKey, { detail: { message, type } }))
}
