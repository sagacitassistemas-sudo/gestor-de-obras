import React, { useState, useEffect } from 'react';

interface MFAModalProps {
  isOpen: boolean;
  email: string;
  mfaTicket: string;
  otpCodeDemo?: string;
  onVerifySuccess: (sessionData: any) => void;
  onCancel: () => void;
}

export const MFAModal: React.FC<MFAModalProps> = ({
  isOpen,
  email,
  mfaTicket,
  otpCodeDemo,
  onVerifySuccess,
  onCancel
}) => {
  const [code, setCode] = useState(otpCodeDemo || '');
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Reset internal state when modal opens or OTP changes
  useEffect(() => {
    if (isOpen) {
      setCode(otpCodeDemo || '');
      setErrorMessage('');
      setIsVerifying(false);
    }
  }, [isOpen, otpCodeDemo]);

  if (!isOpen) return null;

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || code.length < 6) {
      setErrorMessage('Digite o código de 6 dígitos.');
      return;
    }

    setIsVerifying(true);
    setErrorMessage('');

    try {
      const res = await fetch('/api/auth/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mfaTicket, otpCode: code })
      });

      const data = await res.json();
      setIsVerifying(false);

      if (res.ok && data.success) {
        onVerifySuccess(data.session);
      } else {
        setErrorMessage(data.error || 'Falha na verificação do duplo fator.');
      }
    } catch (err) {
      setIsVerifying(false);
      setErrorMessage('Erro de conexão ao validar 2FA.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6 md:p-8 border border-[#c0c7d6] shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[#e2e8f0]">
          <div className="p-2.5 bg-[#eff6ff] text-[#005daa] rounded-lg">
            <span className="material-symbols-outlined text-[24px]">phonelink_lock</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#005daa] uppercase tracking-wider">
              Container de Segurança Firebase
            </span>
            <h3 className="font-headline-sm text-[#191c1e]">Autenticação Duplo Fator (2FA)</h3>
          </div>
        </div>

        <p className="text-body-sm text-[#404753] leading-relaxed mb-4">
          Para garantir a conformidade de segurança no portal, enviamos um código de verificação para{' '}
          <strong className="text-[#191c1e]">{email}</strong>.
        </p>

        {/* Demo OTP Helper Callout */}
        {otpCodeDemo && (
          <div className="mb-4 p-3 bg-[#eff6ff] border border-[#005daa]/30 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#005daa] text-body-sm">
              <span className="material-symbols-outlined text-[18px]">key</span>
              <span>Código 2FA gerado:</span>
            </div>
            <span className="font-metric-mono font-bold text-[#005daa] text-lg bg-white px-2 py-0.5 rounded border border-[#005daa]/20">
              {otpCodeDemo}
            </span>
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 p-3 bg-[#fef2f2] border border-[#ef4444]/30 rounded-md text-[#ef4444] text-body-sm font-bold flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleVerify} className="space-y-6">
          <div>
            <label className="font-label-bold text-[#191c1e] block mb-2 text-center text-label-bold">
              CÓDIGO DE SEGURANÇA (6 DÍGITOS)
            </label>
            <input
              type="text"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="123456"
              className="w-full text-center tracking-[0.5em] font-metric-mono text-2xl py-3 border-2 border-[#005daa] rounded-lg outline-none focus:ring-4 focus:ring-[#005daa]/20 text-[#005daa] font-bold"
            />
          </div>

          <div className="p-3 bg-[#f2f4f6] rounded-lg border border-[#c0c7d6] text-[11px] text-[#707785] space-y-1">
            <div className="flex justify-between font-bold text-[#404753]">
              <span>Contrato / Tenant:</span>
              <span className="text-[#005daa] font-metric-mono">CTR-2026-SYS</span>
            </div>
            <div className="flex justify-between font-bold text-[#404753]">
              <span>Custom Claims no Token:</span>
              <span className="text-[#10b981] font-metric-mono">contrato_id, entidade_id, perfil</span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2.5 border border-[#c0c7d6] rounded-md font-label-bold text-[#404753] hover:bg-[#f2f4f6]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isVerifying}
              className="px-5 py-2.5 bg-[#005daa] text-white rounded-md font-label-bold hover:bg-[#0075d5] flex items-center gap-2 cursor-pointer disabled:opacity-80"
            >
              {isVerifying ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[18px]">sync</span>
                  <span>Validando 2FA...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">verified</span>
                  <span>Confirmar & Emitir Token</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
