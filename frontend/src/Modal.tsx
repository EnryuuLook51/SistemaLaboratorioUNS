import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

export default function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current!
    dialog.showModal()
    return () => dialog.close()
  }, [])
  return <dialog ref={ref} className="modal" onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
    <div className="modal-header"><h2>{title}</h2><button className="icon-button" aria-label="Cerrar" onClick={onClose}><X size={20} /></button></div>
    <div className="modal-body">{children}</div>
  </dialog>
}
