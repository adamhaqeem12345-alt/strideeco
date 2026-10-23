'use client';
import { useEffect, useRef, useState } from 'react';
import { Check, Clock3, Copy, Download, Droplets, FlaskConical, QrCode, RefreshCw, X } from 'lucide-react';
import { machines } from '../lib/machines';
import { formatVoucherCode, voucherQrPayload } from '../lib/vouchers';
import { type PilotState } from '../lib/pilot';

type Voucher = PilotState['redemptions'][number];
type Props = { voucher: Voucher; now: number; busy: boolean; onClose: () => void; onResolve: (body: Record<string, unknown>) => void; notify: (message: string, error?: boolean) => void };
export default function WaterVoucher({ voucher, now, busy, onClose, onResolve, notify }: Props) {
  const dialog = useRef<HTMLElement>(null);
  const close = useRef(onClose); close.current = onClose;
  const [qr, setQr] = useState(''), [qrError, setQrError] = useState(false);
  const [code, setCode] = useState(''), [machineId, setMachineId] = useState(voucher.machine_id ?? '');
  const expired = Date.parse(voucher.expires_at) <= now;
  const seconds = Math.max(0, Math.ceil((Date.parse(voucher.expires_at) - now) / 1000));
  const pending = voucher.status === 'pending' && !expired && Boolean(voucher.machine_id);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const items = () => Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled)') ?? []);
    items()[0]?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close.current();
      if (event.key === 'Tab') { const choices = items(), first = choices[0], last = choices.at(-1); if (!dialog.current?.contains(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first)?.focus(); } else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); } }
    };
    const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', keydown); previous?.focus(); };
  }, [voucher.id]);
  useEffect(() => {
    if (!dialog.current?.contains(document.activeElement)) dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();
  }, [voucher.status, pending]);
  useEffect(() => {
    let active = true; setQr(''); setQrError(false);
    if (pending) import('qrcode').then(({ default: QRCode }) => QRCode.toDataURL(voucherQrPayload(voucher), { errorCorrectionLevel: 'M', margin: 4, width: 320, color: { dark: '#0c343cff', light: '#ffffffff' } })).then(value => { if (active) setQr(value); }).catch(() => { if (active) setQrError(true); });
    return () => { active = false; };
  }, [voucher.id, voucher.token, pending]);
  async function scanQr() {
    try {
      const image = new Image(); image.src = qr; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d'); if (!context) throw new Error('QR reader is unavailable. Use the code instead.');
      context.drawImage(image, 0, 0); const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      const { default: jsQR } = await import('jsqr'); const decoded = jsQR(pixels.data, canvas.width, canvas.height);
      if (!decoded) throw new Error('The QR image could not be read. Use the code instead.');
      onResolve({ action: 'consume-voucher', payload: decoded.data, machineId, result: 'dispensed' });
    } catch (error) { notify(error instanceof Error ? error.message : 'The QR image could not be read.', true); }
  }
  return <div className="modal-backdrop" onClick={onClose}><section ref={dialog} className="modal redemption-modal voucher-modal" role="dialog" aria-modal="true" aria-labelledby="redemption-title" onClick={event => event.stopPropagation()}><button className="modal-close" aria-label="Close redemption" onClick={onClose}><X size={20}/></button><span className="pill"><FlaskConical size={14}/>MOCK WATER VOUCHER</span>
    {voucher.status === 'confirmed' ? <><div className="success-circle"><Check size={32}/></div><h2 id="redemption-title">A fresh finish.</h2><p>The simulator confirmed dispensing. Your {voucher.cost} points were deducted once.</p><div className="info-box"><Check size={18}/><p>Used once. Both the code and QR are now invalid.</p></div><p className="microcopy">{voucher.reward_label} · {voucher.machine_name}. No physical water was dispensed.</p></> : voucher.status !== 'pending' || !pending ? <><span className="small-icon"><RefreshCw size={24}/></span><h2 id="redemption-title">{!voucher.machine_id ? 'This earlier voucher is unavailable.' : voucher.status === 'pending' ? 'This voucher has expired.' : 'Your points are available again.'}</h2><p>{voucher.status === 'failed' ? 'The simulated machine failed. Your points reservation has been released.' : seconds === 0 ? 'This voucher has expired. Refresh your wallet to confirm the released reservation.' : 'This earlier voucher was not bound to a machine. Its points release when it expires.'}</p></> : <><h2 id="redemption-title">Your water voucher is ready.</h2><p>{voucher.reward_label}<br/><strong>{voucher.machine_name}</strong> · mock machine</p><p className="microcopy">Use the code or QR once at this selected machine. Both represent the same voucher.</p><div className="voucher-qr">{qr ? <img src={qr} width={240} height={240} alt="One-time water voucher QR code"/> : <p>{qrError ? 'QR unavailable. Your code still works.' : 'Preparing QR…'}</p>}</div><div className="redemption-code voucher-code">{formatVoucherCode(voucher.token)}</div><div className="voucher-copy-actions"><button className="text-button" onClick={() => navigator.clipboard.writeText(formatVoucherCode(voucher.token)).then(() => notify('Code copied.')).catch(() => notify('Copy was unavailable. Select the code to copy it.', true))}><Copy size={14}/>Copy code</button>{qr && <a className="text-button" href={qr} download={`strideeco-water-${voucher.id}.png`}><Download size={14}/>Download QR</a>}</div><div className={`redemption-expiry${seconds < 120 ? ' urgent' : ''}`} role="timer"><Clock3 size={14}/>{String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')} remaining · {voucher.cost} points reserved</div><div className="simulator-actions"><span className="field-label">TRY THE MOCK MACHINE</span><label className="voucher-field">Simulator machine<select aria-label="Simulator machine" value={machineId} onChange={event => setMachineId(event.target.value)}>{machines.map(machine => <option key={machine.id} value={machine.id}>{machine.name}</option>)}</select></label><button className="button primary full" disabled={busy || !qr} onClick={scanQr}><QrCode size={17}/>Simulate QR scan</button><form onSubmit={event => { event.preventDefault(); onResolve({ action: 'resolve-water', id: voucher.id, token: code, machineId, result: 'dispensed' }); }}><label className="voucher-field">Voucher code<input aria-label="Voucher code" autoComplete="off" maxLength={64} value={code} onChange={event => setCode(event.target.value)} placeholder="Enter the code above"/></label><button className="button secondary full" disabled={busy || !code.trim()} type="submit"><Droplets size={16}/>Redeem entered code</button></form><button className="text-button centered" disabled={busy} onClick={() => onResolve({ action: 'resolve-water', id: voucher.id, token: voucher.token, machineId, result: 'failed' })}>Simulate machine failure</button></div><p className="microcopy">No real dispenser is connected. A failed or expired voucher releases the reserved points.</p></>}
  </section></div>;
}