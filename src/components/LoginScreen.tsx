import React, { useState, useEffect } from 'react';
import { MFAModal } from './MFAModal';
import { AuthSession } from '../types';
import { auth } from '../lib/firebase';
import { signInWithPopup, GoogleAuthProvider, OAuthProvider, signInWithEmailAndPassword } from 'firebase/auth';
import { supabase } from '../lib/supabaseClient';

interface LoginScreenProps {
  onLoginSuccess: (session: AuthSession) => void;
  onOpenSupportModal?: () => void;
  onOpenOnboarding?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLoginSuccess,
  onOpenSupportModal,
  onOpenOnboarding
}) => {
  // Email/password form state
  const [email, setEmail] = useState('financeiro@logisticsglobal.com.br');
  const [password, setPassword] = useState('••••••••');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isEmailLoading, setIsEmailLoading] = useState(false);

  // OAuth loading state (separate from email)
  const [isOAuthLoading, setIsOAuthLoading] = useState(false);

  // OAuth confirmation step — after popup, before session creation
  const [oauthPendingConfirm, setOauthPendingConfirm] = useState<{
    providerType: 'google' | 'microsoft';
    uid: string;
    email: string;
    displayName: string;
    photoURL: string;
  } | null>(null);
  const [isOAuthConfirming, setIsOAuthConfirming] = useState(false);

  // Forgot password modal
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitted, setForgotSubmitted] = useState(false);

  // 2FA MFA State — only for email/password flow
  const [mfaModalOpen, setMfaModalOpen] = useState(false);
  const [mfaTicket, setMfaTicket] = useState('');
  const [otpCodeDemo, setOtpCodeDemo] = useState('');
  const [mfaEmail, setMfaEmail] = useState('');

  // Error message
  const [errorMessage, setErrorMessage] = useState('');

  // Invite state
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteData, setInviteData] = useState<any>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState(false);

  // Recovery / Reset Password state
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [resetEmail, setResetEmail] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotPreviewUrl, setForgotPreviewUrl] = useState<string | null>(null);
  const [forgotResetUrl, setForgotResetUrl] = useState<string | null>(null);

  // Check URL for invite or reset token on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('inviteToken');
    if (token) {
      setInviteToken(token);
      validateInvite(token);
    }
    const rToken = params.get('resetToken');
    const rEmail = params.get('email');
    if (rToken) {
      setResetToken(rToken);
      if (rEmail) setResetEmail(decodeURIComponent(rEmail));
    }
  }, []);

  const validateInvite = async (token: string) => {
    setInviteLoading(true);
    setErrorMessage('');
    try {
      const res = await fetch(`/api/convites/${token}`);
      const data = await res.json();
      if (res.ok) {
        setInviteData(data);
      } else {
        setErrorMessage(data.error || 'Convite inválido ou expirado.');
      }
    } catch (err) {
      setErrorMessage('Erro ao validar convite.');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleAcceptInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (invitePassword.length < 6) {
      setErrorMessage('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    setInviteLoading(true);
    setErrorMessage('');
    try {
      const res = await fetch('/api/convites/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: inviteToken, nome: inviteName, senha: invitePassword })
      });
      const data = await res.json();
      if (res.ok) {
        setInviteSuccess(true);
        setInviteToken(null);
      } else {
        setErrorMessage(data.error || 'Erro ao aceitar convite.');
      }
    } catch (err) {
      setErrorMessage('Erro de conexão ao aceitar convite.');
    } finally {
      setInviteLoading(false);
    }
  };

  // Derived: any auth operation in progress
  const isLoading = isEmailLoading || isOAuthLoading || isOAuthConfirming;

  // ─── Email/Password Login Handler ───
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isOAuthLoading || oauthPendingConfirm) return;

    setIsEmailLoading(true);
    setErrorMessage('');

    try {
      // 1. Firebase primary auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Backend validation + MFA challenge
      const res = await fetch('/api/auth/login-mfa-step1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid, email: user.email, password })
      });

      const data = await res.json();
      setIsEmailLoading(false);

      if (res.ok && data.mfaRequired) {
        setMfaTicket(data.mfaTicket);
        setOtpCodeDemo(data.otpCodeDemo);
        setMfaEmail(user.email || email);
        setMfaModalOpen(true);
      } else if (!res.ok) {
        auth.signOut();
        setErrorMessage(data.error || 'Erro na verificação de permissões do sistema.');
      }
    } catch (err: any) {
      setIsEmailLoading(false);

      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setErrorMessage('E-mail ou senha incorretos.');
      } else {
        setErrorMessage(err.message || 'Erro na autenticação. Verifique sua conexão.');
      }
    }
  };

  // ─── OAuth Step 1: Open popup and get selected account ───
  const handleOAuthLogin = async (providerType: 'google' | 'microsoft') => {
    if (isEmailLoading || oauthPendingConfirm) return;

    setIsOAuthLoading(true);
    setErrorMessage('');

    try {
      const provider = providerType === 'google'
        ? new GoogleAuthProvider()
        : new OAuthProvider('microsoft.com');
      provider.setCustomParameters({ prompt: 'select_account' });

      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      setIsOAuthLoading(false);

      // Step 1 complete → show confirmation modal with selected account info
      setOauthPendingConfirm({
        providerType,
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || '',
        photoURL: user.photoURL || ''
      });
    } catch (e: any) {
      setIsOAuthLoading(false);
      if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') {
        return; // User cancelled — no error
      }
      auth.signOut();
      setErrorMessage(e.message || `Falha na autenticação ${providerType === 'google' ? 'Google' : 'Microsoft'} OAuth`);
    }
  };

  // ─── OAuth Step 2: User confirms the selected email ───
  const handleOAuthConfirm = async () => {
    if (!oauthPendingConfirm) return;

    setIsOAuthConfirming(true);
    setErrorMessage('');

    try {
      const { providerType, uid, email: oauthEmail, displayName, photoURL } = oauthPendingConfirm;

      const res = await fetch('/api/auth/oauth-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: providerType,
          uid,
          email: oauthEmail,
          displayName,
          photoURL
        })
      });

      const data = await res.json();
      setIsOAuthConfirming(false);

      if (res.ok && data.session) {
        setOauthPendingConfirm(null);
        setIsOAuthConfirming(false);
        supabase.auth.setSession({
          access_token: data.session.idToken,
          refresh_token: data.session.idToken,
        }).catch((err) => {
          console.warn('[LoginScreen] supabase.auth.setSession non-blocking warning:', err);
        });
        onLoginSuccess(data.session);
      } else if (!res.ok) {
        setIsOAuthConfirming(false);
        setOauthPendingConfirm(null);
        auth.signOut();
        setErrorMessage(data.error || 'Erro na validação do usuário no sistema.');
      }
    } catch (e: any) {
      setIsOAuthConfirming(false);
      setOauthPendingConfirm(null);
      auth.signOut();
      setErrorMessage(e.message || 'Falha ao confirmar autenticação OAuth.');
    }
  };

  // ─── OAuth Cancel Confirmation ───
  const handleOAuthCancelConfirm = () => {
    setOauthPendingConfirm(null);
    auth.signOut();
  };

  // ─── MFA Verification Success Handler ───
  const handleMfaVerifySuccess = async (sessionData: AuthSession) => {
    setMfaModalOpen(false);
    supabase.auth.setSession({
      access_token: sessionData.idToken,
      refresh_token: sessionData.idToken,
    }).catch((err) => {
      console.warn('[LoginScreen] supabase.auth.setSession non-blocking warning:', err);
    });
    onLoginSuccess(sessionData);
  };

  // ─── MFA Cancel Handler ───
  const handleMfaCancel = () => {
    setMfaModalOpen(false);
    setMfaTicket('');
    setOtpCodeDemo('');
    setMfaEmail('');
    // Sign out from Firebase since user cancelled MFA
    auth.signOut();
  };

  // ─── Forgot Password Handler ───
  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setForgotLoading(true);
    setErrorMessage('');
    try {
      const res = await fetch('/api/auth/request-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail })
      });
      const data = await res.json();
      if (res.ok) {
        setForgotSubmitted(true);
        if (data.previewUrl) setForgotPreviewUrl(data.previewUrl);
        if (data.resetUrl) setForgotResetUrl(data.resetUrl);
      } else {
        setErrorMessage(data.error || 'Erro ao enviar e-mail de recuperação.');
      }
    } catch (err) {
      setErrorMessage('Erro ao solicitar redefinição de senha.');
    } finally {
      setForgotLoading(false);
    }
  };

  // Recovery / Reset Password UI & Generator state
  const [showResetNewPassword, setShowResetNewPassword] = useState(false);
  const [showResetConfirmPassword, setShowResetConfirmPassword] = useState(false);
  const [passwordCopied, setPasswordCopied] = useState(false);

  const generateStrongPassword = () => {
    const uppers = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lowers = 'abcdefghijkmnopqrstuvwxyz';
    const numbers = '23456789';
    const specials = '!@#$%&*+?';
    const all = uppers + lowers + numbers + specials;

    let pwd = '';
    const getRandomChar = (chars: string) => {
      const array = new Uint32Array(1);
      window.crypto.getRandomValues(array);
      return chars[array[0] % chars.length];
    };

    // Pick at least 2 of each category for maximum strength
    pwd += getRandomChar(uppers) + getRandomChar(uppers);
    pwd += getRandomChar(lowers) + getRandomChar(lowers);
    pwd += getRandomChar(numbers) + getRandomChar(numbers);
    pwd += getRandomChar(specials) + getRandomChar(specials);

    while (pwd.length < 14) {
      pwd += getRandomChar(all);
    }

    // Shuffle characters
    const arr = pwd.split('');
    for (let i = arr.length - 1; i > 0; i--) {
      const randArr = new Uint32Array(1);
      window.crypto.getRandomValues(randArr);
      const j = randArr[0] % (i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    const finalPassword = arr.join('');

    setResetNewPassword(finalPassword);
    setResetConfirmPassword(finalPassword);
    setShowResetNewPassword(true);
    setShowResetConfirmPassword(true);

    try {
      navigator.clipboard.writeText(finalPassword);
      setPasswordCopied(true);
      setTimeout(() => setPasswordCopied(false), 3500);
    } catch (e) {
      console.warn('Clipboard write error:', e);
    }
  };

  // Password requirements criteria
  const hasMinLength = resetNewPassword.length >= 10;
  const hasUpper = /[A-Z]/.test(resetNewPassword);
  const hasLower = /[a-z]/.test(resetNewPassword);
  const hasNumber = /[0-9]/.test(resetNewPassword);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(resetNewPassword);
  const passwordsMatch = resetNewPassword.length > 0 && resetNewPassword === resetConfirmPassword;

  const validCount = [hasMinLength, hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length;
  const isFormValid = hasMinLength && hasUpper && hasLower && hasNumber && hasSpecial && passwordsMatch;

  // ─── Reset Password with Token Handler ───
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasMinLength) {
      setErrorMessage('A nova senha deve ter no mínimo 10 caracteres.');
      return;
    }
    if (!hasUpper || !hasLower || !hasNumber || !hasSpecial) {
      setErrorMessage('A senha deve conter letras maiúsculas, minúsculas, números e caracteres especiais.');
      return;
    }
    if (!passwordsMatch) {
      setErrorMessage('A confirmação de senha não coincide com a nova senha.');
      return;
    }
    setResetLoading(true);
    setErrorMessage('');
    try {
      const res = await fetch('/api/auth/reset-password-with-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, newPassword: resetNewPassword })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setResetSuccess(true);
        setTimeout(() => {
          setResetToken(null);
          setResetSuccess(false);
          window.history.replaceState({}, document.title, window.location.pathname);
        }, 3000);
      } else {
        setErrorMessage(data.error || 'Erro ao redefinir a senha.');
      }
    } catch (err) {
      setErrorMessage('Erro de conexão ao redefinir a senha.');
    } finally {
      setResetLoading(false);
    }
  };

  // ─── Render: Reset Password Screen ───
  if (resetToken) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[#f7f9fb] font-body-md text-[#191c1e]">
        <div className="w-full max-w-[500px] bg-white p-8 rounded-xl border border-[#c0c7d6] shadow-sm animate-in zoom-in-95">
          <div className="flex justify-center mb-4">
            <span className="material-symbols-outlined text-[44px] text-[#005daa]">vpn_key</span>
          </div>
          <h2 className="font-headline-sm text-center text-[#191c1e] mb-1">Redefinição de Senha & Acesso Master</h2>
          <p className="text-center text-[#404753] text-xs mb-5">
            {resetEmail ? (
              <>Defina uma nova credencial segura para <strong className="text-[#005daa]">{resetEmail}</strong></>
            ) : (
              'Defina sua nova credencial de segurança corporativa'
            )}
          </p>

          {errorMessage && (
            <div className="mb-5 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-xs font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              {errorMessage}
            </div>
          )}

          {passwordCopied && (
            <div className="mb-5 p-2.5 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-md text-xs font-bold flex items-center justify-center gap-2 animate-in fade-in">
              <span className="material-symbols-outlined text-[16px] text-emerald-600">content_copy</span>
              <span>Senha forte gerada e copiada para a área de transferência!</span>
            </div>
          )}

          {resetSuccess ? (
            <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-lg text-center space-y-2 animate-in fade-in">
              <span className="material-symbols-outlined text-emerald-600 text-4xl">check_circle</span>
              <h3 className="font-bold text-emerald-800 text-base">Senha Redefinida com Sucesso!</h3>
              <p className="text-xs text-emerald-700">Redirecionando para a tela de login...</p>
            </div>
          ) : (
            <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
              {/* Gerador de Senha Automática Button */}
              <div className="flex items-center justify-between p-2.5 bg-blue-50/70 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-1.5 text-xs text-[#005daa] font-bold">
                  <span className="material-symbols-outlined text-base">security</span>
                  <span>Gerador de Senha Segura</span>
                </div>
                <button
                  type="button"
                  onClick={generateStrongPassword}
                  className="px-3 py-1 bg-[#005daa] hover:bg-[#0075d5] text-white text-xs font-bold rounded-md flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all"
                  title="Gerar automaticamente uma senha com 14 caracteres incluindo maiúsculas, minúsculas, números e símbolos"
                >
                  <span className="material-symbols-outlined text-[15px]">auto_fix_high</span>
                  <span>Gerar Senha Forte (14 car.)</span>
                </button>
              </div>

              {/* Campo 1: Nova Senha */}
              <div>
                <label className="font-label-bold text-[11px] uppercase text-[#404753] block mb-1">
                  Nova Senha <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showResetNewPassword ? 'text' : 'password'}
                    required
                    placeholder="Mínimo 10 caracteres"
                    value={resetNewPassword}
                    onChange={(e) => setResetNewPassword(e.target.value)}
                    className="w-full pl-3.5 pr-20 py-2.5 bg-white border border-[#c0c7d6] rounded-md font-body-md text-sm outline-none focus:border-[#005daa]"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                    {resetNewPassword && (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(resetNewPassword);
                          setPasswordCopied(true);
                          setTimeout(() => setPasswordCopied(false), 3000);
                        }}
                        className="p-1 text-slate-400 hover:text-[#005daa] transition-colors"
                        title="Copiar senha"
                      >
                        <span className="material-symbols-outlined text-[18px]">content_copy</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowResetNewPassword(!showResetNewPassword)}
                      className="p-1 text-slate-400 hover:text-slate-700 transition-colors"
                      title={showResetNewPassword ? 'Ocultar senha' : 'Visualizar senha'}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {showResetNewPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Força da Senha Progress Bar */}
              {resetNewPassword.length > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold">
                    <span className="text-slate-500">Força da Senha:</span>
                    <span className={
                      validCount <= 2 ? 'text-rose-600' :
                      validCount <= 4 ? 'text-amber-600' : 'text-emerald-600'
                    }>
                      {validCount <= 2 ? 'Fraca' :
                       validCount <= 4 ? 'Média / Boa' : 'Excelente (Muito Forte)'}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden flex gap-1">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <div
                        key={level}
                        className={`flex-1 h-full rounded-full transition-all duration-300 ${
                          validCount >= level
                            ? validCount <= 2
                              ? 'bg-rose-500'
                              : validCount <= 4
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                            : 'bg-slate-200'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Campo 2: Confirmar Nova Senha */}
              <div>
                <label className="font-label-bold text-[11px] uppercase text-[#404753] block mb-1">
                  Confirmar Nova Senha <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showResetConfirmPassword ? 'text' : 'password'}
                    required
                    placeholder="Repita a nova senha"
                    value={resetConfirmPassword}
                    onChange={(e) => setResetConfirmPassword(e.target.value)}
                    className="w-full pl-3.5 pr-10 py-2.5 bg-white border border-[#c0c7d6] rounded-md font-body-md text-sm outline-none focus:border-[#005daa]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetConfirmPassword(!showResetConfirmPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 transition-colors"
                    title={showResetConfirmPassword ? 'Ocultar senha' : 'Visualizar senha'}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {showResetConfirmPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Requisitos Checklist */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5 text-[11px]">
                <div className="text-slate-500 font-bold uppercase text-[10px] mb-1">Critérios de Segurança Obrigatórios:</div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-slate-600">
                  <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-700 font-bold' : 'text-slate-500'}`}>
                    <span className="material-symbols-outlined text-[14px]">
                      {hasMinLength ? 'check_circle' : 'radio_button_unchecked'}
                    </span>
                    <span>Mínimo 10 caracteres</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${hasUpper ? 'text-emerald-700 font-bold' : 'text-slate-500'}`}>
                    <span className="material-symbols-outlined text-[14px]">
                      {hasUpper ? 'check_circle' : 'radio_button_unchecked'}
                    </span>
                    <span>1 Maiúscula (A-Z)</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${hasLower ? 'text-emerald-700 font-bold' : 'text-slate-500'}`}>
                    <span className="material-symbols-outlined text-[14px]">
                      {hasLower ? 'check_circle' : 'radio_button_unchecked'}
                    </span>
                    <span>1 Minúscula (a-z)</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-emerald-700 font-bold' : 'text-slate-500'}`}>
                    <span className="material-symbols-outlined text-[14px]">
                      {hasNumber ? 'check_circle' : 'radio_button_unchecked'}
                    </span>
                    <span>1 Número (0-9)</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${hasSpecial ? 'text-emerald-700 font-bold' : 'text-slate-500'}`}>
                    <span className="material-symbols-outlined text-[14px]">
                      {hasSpecial ? 'check_circle' : 'radio_button_unchecked'}
                    </span>
                    <span>1 Símbolo (!@#$...)</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${passwordsMatch ? 'text-emerald-700 font-bold' : 'text-slate-500'}`}>
                    <span className="material-symbols-outlined text-[14px]">
                      {passwordsMatch ? 'check_circle' : 'radio_button_unchecked'}
                    </span>
                    <span>Senhas coincidem</span>
                  </div>
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setResetToken(null);
                    window.history.replaceState({}, document.title, window.location.pathname);
                  }}
                  className="flex-1 py-2.5 border border-[#c0c7d6] rounded-md font-label-bold text-[#404753] hover:bg-[#f2f4f6] cursor-pointer text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={resetLoading || !isFormValid}
                  className="flex-1 py-2.5 bg-[#005daa] text-white rounded-md font-label-bold hover:bg-[#0075d5] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer shadow-2xs text-xs transition-all"
                >
                  {resetLoading ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
                      <span>Salvando...</span>
                    </>
                  ) : (
                    'Salvar Senha'
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  if (inviteToken && !inviteSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[#f7f9fb] font-body-md text-[#191c1e]">
        <div className="w-full max-w-[480px] bg-white p-8 rounded-xl border border-[#c0c7d6] shadow-sm animate-in zoom-in-95">
          <div className="flex justify-center mb-6">
            <span className="material-symbols-outlined text-[48px] text-[#005daa]">mark_email_read</span>
          </div>
          <h2 className="font-headline-sm text-center text-[#191c1e] mb-2">Completar Cadastro</h2>
          <p className="text-center text-[#404753] text-sm mb-6">Você recebeu um convite para acessar o Gestor de Obras.</p>
          
          {errorMessage && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              {errorMessage}
            </div>
          )}
          
          {inviteLoading ? (
            <div className="flex justify-center py-8">
              <span className="material-symbols-outlined animate-spin text-[32px] text-[#005daa]">progress_activity</span>
            </div>
          ) : inviteData ? (
            <form onSubmit={handleAcceptInvite} className="space-y-4">
              <div>
                <label className="font-label-bold text-[11px] uppercase text-[#404753] block mb-1">E-mail</label>
                <input type="email" value={inviteData.email} disabled className="w-full px-3.5 py-2.5 bg-slate-100 border border-[#c0c7d6] rounded-md font-body-md text-slate-500 cursor-not-allowed outline-none" />
              </div>
              <div>
                <label className="font-label-bold text-[11px] uppercase text-[#404753] block mb-1">Nome Completo <span className="text-red-500">*</span></label>
                <input type="text" value={inviteName} onChange={(e) => setInviteName(e.target.value)} required className="w-full px-3.5 py-2.5 bg-white border border-[#c0c7d6] rounded-md font-body-md outline-none focus:border-[#005daa]" />
              </div>
              <div>
                <label className="font-label-bold text-[11px] uppercase text-[#404753] block mb-1">Criar Senha <span className="text-red-500">*</span></label>
                <input type="password" minLength={6} placeholder="Mínimo 6 caracteres" value={invitePassword} onChange={(e) => setInvitePassword(e.target.value)} required className="w-full px-3.5 py-2.5 bg-white border border-[#c0c7d6] rounded-md font-body-md outline-none focus:border-[#005daa]" />
              </div>
              <button type="submit" disabled={inviteLoading} className="w-full py-3 mt-2 bg-[#005daa] text-white rounded-md font-label-bold hover:bg-[#0075d5] transition-colors flex items-center justify-center gap-2">
                Concluir Cadastro e Criar Conta
              </button>
            </form>
          ) : (
            <div className="text-center mt-4">
              <button onClick={() => { setInviteToken(null); setErrorMessage(''); }} className="text-[#005daa] hover:underline text-sm font-label-bold cursor-pointer">
                Voltar para o Login
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#f7f9fb] relative overflow-hidden font-body-md text-[#191c1e]">
      {/* Ambient Background Blur Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] rounded-full bg-[#005daa]/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full bg-[#4b41e1]/5 blur-[120px] pointer-events-none" />

      {/* Main Login Screen Layout */}
      <div className="w-full max-w-[1100px] z-10 flex items-center justify-center my-8">
        
        {/* Left/Center Login Container */}
        <main className="w-full max-w-[480px] animate-in fade-in zoom-in duration-500">
          {/* Brand Header */}
          <div className="flex flex-col items-center mb-8">
            <img 
              src="/logo-entrada.png" 
              alt="Logo do Sistema" 
              className="max-h-24 w-auto object-contain mb-4"
            />
            <p className="font-body-md text-[#404753] mt-1.5 text-center">
              Supplier Portal Infrastructure
            </p>
          </div>

          {/* Login Card */}
          <div className="bg-white border border-[#c0c7d6] rounded-xl shadow-sm p-8 md:p-10 relative">
            
            {inviteSuccess && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-800 rounded-md flex items-start gap-3">
                <span className="material-symbols-outlined text-green-600 mt-0.5">check_circle</span>
                <div>
                  <h4 className="font-bold text-sm">Conta criada com sucesso!</h4>
                  <p className="text-sm mt-1 text-green-700">Seu cadastro foi concluído e ativado. Utilize seu e-mail e a senha que você acabou de criar para entrar no sistema.</p>
                </div>
              </div>
            )}

            <header className="mb-8">
              <div className="flex justify-between items-center mb-2">
                <h2 className="font-headline-sm text-headline-sm text-[#191c1e]">
                  Seja bem-vindo.
                </h2>
                <span className="text-[10px] font-bold text-[#005daa] bg-[#eff6ff] px-2 py-0.5 rounded border border-[#005daa]/20">
                  Container Firebase Auth
                </span>
              </div>
              <p className="font-body-sm text-[#404753]">
                Acesse sua conta para gerenciar contratos e faturamentos com autenticação OAuth SSO ou Duplo Fator (2FA).
              </p>
            </header>

            {/* ═══════════════════════════════════════════
                SECTION 1: OAuth Identity Providers (ISOLATED)
                ═══════════════════════════════════════════ */}
            <div className="space-y-3 mb-6">
              <p className="font-label-bold text-[11px] text-[#404753] uppercase tracking-wider">
                Autenticação Principal via Identity Provider (OAuth)
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleOAuthLogin('google')}
                  className="w-full py-2.5 px-3 bg-white border border-[#c0c7d6] hover:bg-[#f8fafc] rounded-md font-label-bold text-xs text-[#1e293b] transition-all shadow-2xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isOAuthLoading ? (
                    <span className="material-symbols-outlined animate-spin text-[16px] text-[#707785]">sync</span>
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                  )}
                  <span>Entrar com Google</span>
                </button>

                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleOAuthLogin('microsoft')}
                  className="w-full py-2.5 px-3 bg-white border border-[#c0c7d6] hover:bg-[#f8fafc] rounded-md font-label-bold text-xs text-[#1e293b] transition-all shadow-2xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isOAuthLoading ? (
                    <span className="material-symbols-outlined animate-spin text-[16px] text-[#707785]">sync</span>
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 23 23">
                      <path fill="#f35325" d="M1 1h10v10H1z" />
                      <path fill="#81bc06" d="M12 1h10v10H12z" />
                      <path fill="#05a6f0" d="M1 12h10v10H1z" />
                      <path fill="#ffba08" d="M12 12h10v10H12z" />
                    </svg>
                  )}
                  <span>Microsoft SSO</span>
                </button>
              </div>
            </div>

            {/* ═══════════════ SEPARATOR ═══════════════ */}
            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-[#e2e8f0]"></div>
              <span className="flex-shrink mx-3 font-label-bold text-[10px] text-[#94a3b8] uppercase">
                ou acesse com e-mail (fallback manual)
              </span>
              <div className="flex-grow border-t border-[#e2e8f0]"></div>
            </div>

            {/* ═══════════════════════════════════════════
                SECTION 2: Email/Password Form (ISOLATED)
                ═══════════════════════════════════════════ */}
            {errorMessage && (
              <div className="mb-4 p-3 bg-[#fef2f2] border border-[#ef4444]/30 rounded-md text-[#ef4444] text-body-sm font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">error</span>
                <span>{errorMessage}</span>
              </div>
            )}

            <form className="space-y-6" onSubmit={handleEmailSubmit}>
              {/* Email Input */}
              <div className="space-y-2">
                <label className="font-label-bold text-label-bold text-[#191c1e] block" htmlFor="email">
                  E-mail corporativo
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#707785] text-[20px] select-none">
                    mail
                  </span>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="exemplo@empresa.com.br"
                    required
                    disabled={isOAuthLoading}
                    className="w-full pl-10 pr-4 py-3 bg-white border border-[#c0c7d6] rounded-md font-body-md text-[#191c1e] placeholder:text-[#707785] focus:ring-2 focus:ring-[#005daa]/20 focus:border-[#005daa] transition-all outline-none disabled:opacity-60"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="font-label-bold text-label-bold text-[#191c1e]" htmlFor="password">
                    Senha
                  </label>
                  <button
                    type="button"
                    onClick={() => setForgotModalOpen(true)}
                    className="font-label-bold text-label-bold text-[#005daa] hover:underline transition-all"
                  >
                    Esqueceu a senha?
                  </button>
                </div>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#707785] text-[20px] select-none">
                    lock
                  </span>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    disabled={isOAuthLoading}
                    className="w-full pl-10 pr-4 py-3 bg-white border border-[#c0c7d6] rounded-md font-body-md text-[#191c1e] placeholder:text-[#707785] focus:ring-2 focus:ring-[#005daa]/20 focus:border-[#005daa] transition-all outline-none disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#707785] hover:text-[#191c1e] transition-colors p-1"
                  >
                    <span className="material-symbols-outlined text-[20px] select-none">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Remember Me */}
              <div className="flex items-center gap-2.5">
                <input
                  id="remember"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 text-[#005daa] border-[#c0c7d6] rounded focus:ring-[#005daa] cursor-pointer"
                />
                <label htmlFor="remember" className="font-body-sm text-[#404753] cursor-pointer select-none">
                  Lembrar deste dispositivo com 2FA ativo
                </label>
              </div>

              {/* CTA Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 bg-[#005daa] text-white rounded-md font-label-bold text-label-bold hover:bg-[#0075d5] active:scale-[0.98] transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-80 group cursor-pointer"
              >
                {isEmailLoading ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[20px]">sync</span>
                    <span>Iniciando 2FA...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[20px]">lock_open</span>
                    <span>Acessar com Duplo Fator (2FA)</span>
                  </>
                )}
              </button>
            </form>

            {/* Onboarding & Demo Helper Links */}
            <div className="mt-6 pt-4 border-t border-[#e2e8f0] space-y-2">
              <button
                type="button"
                onClick={onOpenOnboarding}
                className="w-full py-2.5 px-3 bg-[#f0fdf4] text-[#10b981] hover:bg-[#dcfce7] border border-[#10b981]/30 rounded-md font-label-bold text-[12px] transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">how_to_reg</span>
                <span>Onboarding de Novo Usuário (Recebeu Convite?)</span>
              </button>
            </div>

            {/* Footer Help */}
            <div className="mt-8 pt-6 border-t border-[#c0c7d6] flex flex-col items-center gap-4">
              <p className="font-body-sm text-[#404753] text-center">
                Problemas com o acesso ou precisa solicitar cadastro?<br/>
                O suporte oficial é realizado através do e-mail:
              </p>
              <div className="flex gap-4 flex-wrap justify-center">
                <a
                  href="mailto:worksmanager.suporte@gmail.com"
                  className="flex items-center gap-2 px-4 py-2 bg-[#f2f4f6] hover:bg-[#eceef0] border border-[#c0c7d6] rounded-md transition-colors font-label-bold text-label-bold text-[#404753]"
                >
                  <span className="material-symbols-outlined text-[18px]">mail</span>
                  worksmanager.suporte@gmail.com
                </a>
                <button
                  type="button"
                  onClick={onOpenSupportModal}
                  className="flex items-center gap-2 px-4 py-2 bg-[#f2f4f6] hover:bg-[#eceef0] border border-[#c0c7d6] rounded-md transition-colors font-label-bold text-label-bold text-[#404753] cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">support_agent</span>
                  Suporte Interno
                </button>
                <a
                  href="https://wa.me/5511999999999?text=Preciso%20de%20suporte%20no%20Portal%20Systems%20Storage"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-[#f2f4f6] hover:bg-[#eceef0] border border-[#c0c7d6] rounded-md transition-colors font-label-bold text-label-bold text-[#404753]"
                >
                  <span className="material-symbols-outlined text-[18px]">chat</span>
                  WhatsApp
                </a>
              </div>
            </div>
          </div>

          {/* Trust Badges */}
          <div className="mt-8 flex justify-center items-center gap-8 opacity-70">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-[#10b981]">verified_user</span>
              <span className="font-body-sm text-[#404753]">Acesso Seguro SSL</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-[#005daa]">policy</span>
              <span className="font-body-sm text-[#404753]">LGPD Compliant</span>
            </div>
          </div>
        </main>


      </div>

      {/* ═══════════════════════════════════════════
          OAuth Step 2: Confirm Selected Account Modal
          ═══════════════════════════════════════════ */}
      {oauthPendingConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 md:p-8 border border-[#c0c7d6] shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[#e2e8f0]">
              <div className="p-2.5 bg-[#eff6ff] text-[#005daa] rounded-lg">
                <span className="material-symbols-outlined text-[24px]">verified_user</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-[#005daa] uppercase tracking-wider">
                  Confirmação de Identidade OAuth
                </span>
                <h3 className="font-headline-sm text-[#191c1e]">Confirmar Acesso</h3>
              </div>
            </div>

            <p className="text-body-sm text-[#404753] leading-relaxed mb-5">
              Você selecionou a seguinte conta para autenticação via{' '}
              <strong className="text-[#191c1e]">
                {oauthPendingConfirm.providerType === 'google' ? 'Google' : 'Microsoft'}
              </strong>.
              Confirme para prosseguir com o acesso ao sistema.
            </p>

            {/* Selected Account Card */}
            <div className="p-4 bg-[#f7f9fb] rounded-lg border border-[#c0c7d6] mb-6">
              <div className="flex items-center gap-3">
                {oauthPendingConfirm.photoURL ? (
                  <img
                    src={oauthPendingConfirm.photoURL}
                    alt="Avatar"
                    className="w-12 h-12 rounded-full border-2 border-[#005daa]/20"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-[#005daa]/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[#005daa] text-[24px]">account_circle</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-label-bold text-[#191c1e] truncate">
                    {oauthPendingConfirm.displayName || 'Usuário'}
                  </p>
                  <p className="text-body-sm text-[#005daa] font-bold truncate">
                    {oauthPendingConfirm.email}
                  </p>
                </div>
                {oauthPendingConfirm.providerType === 'google' ? (
                  <svg className="w-6 h-6 flex-shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 flex-shrink-0" viewBox="0 0 23 23">
                    <path fill="#f35325" d="M1 1h10v10H1z" />
                    <path fill="#81bc06" d="M12 1h10v10H12z" />
                    <path fill="#05a6f0" d="M1 12h10v10H1z" />
                    <path fill="#ffba08" d="M12 12h10v10H12z" />
                  </svg>
                )}
              </div>
            </div>

            {/* Metadata */}
            <div className="p-3 bg-[#f2f4f6] rounded-lg border border-[#c0c7d6] text-[11px] text-[#707785] space-y-1 mb-6">
              <div className="flex justify-between font-bold text-[#404753]">
                <span>Provedor OAuth:</span>
                <span className="text-[#005daa] font-metric-mono">
                  {oauthPendingConfirm.providerType === 'google' ? 'google.com' : 'microsoft.com'}
                </span>
              </div>
              <div className="flex justify-between font-bold text-[#404753]">
                <span>Verificação de Identidade:</span>
                <span className="text-[#10b981] font-metric-mono">SSO Verificado</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={handleOAuthCancelConfirm}
                disabled={isOAuthConfirming}
                className="px-4 py-2.5 border border-[#c0c7d6] rounded-md font-label-bold text-[#404753] hover:bg-[#f2f4f6] disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleOAuthConfirm}
                disabled={isOAuthConfirming}
                className="px-5 py-2.5 bg-[#005daa] text-white rounded-md font-label-bold hover:bg-[#0075d5] flex items-center gap-2 cursor-pointer disabled:opacity-80"
              >
                {isOAuthConfirming ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[18px]">sync</span>
                    <span>Validando...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">check_circle</span>
                    <span>Confirmar e Acessar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2FA MFA Verification Modal — only for email/password flow */}
      <MFAModal
        isOpen={mfaModalOpen}
        email={mfaEmail}
        mfaTicket={mfaTicket}
        otpCodeDemo={otpCodeDemo}
        onVerifySuccess={handleMfaVerifySuccess}
        onCancel={handleMfaCancel}
      />

      {/* Forgot Password Modal */}
      {forgotModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 border border-[#c0c7d6] shadow-xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-headline-sm text-[#005daa]">Recuperar Senha</h3>
              <button
                onClick={() => setForgotModalOpen(false)}
                className="text-[#707785] hover:text-[#191c1e]"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            {forgotSubmitted ? (
              <div className="p-4 bg-[#ecfdf5] border border-[#10b981]/30 rounded-lg text-center space-y-3">
                <span className="material-symbols-outlined text-[#10b981] text-3xl">check_circle</span>
                <p className="font-bold text-[#10b981] text-sm">Instruções enviadas com sucesso!</p>
                <p className="text-body-sm text-[#404753] text-xs">
                  O link de redefinição de acesso foi gerado para <strong>{forgotEmail}</strong>.
                </p>

                {forgotResetUrl && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        const url = new URL(forgotResetUrl);
                        const token = url.searchParams.get('resetToken');
                        if (token) {
                          setResetToken(token);
                          setResetEmail(forgotEmail);
                          setForgotModalOpen(false);
                          setForgotSubmitted(false);
                        }
                      }}
                      className="w-full py-2.5 bg-[#005daa] text-white rounded-md font-bold text-xs hover:bg-[#0075d5] flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                    >
                      <span className="material-symbols-outlined text-base">vpn_key</span>
                      <span>Abrir Tela de Redefinição Imediata</span>
                    </button>
                  </div>
                )}

                {forgotPreviewUrl && (
                  <div className="pt-1">
                    <a
                      href={forgotPreviewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1 text-xs text-[#005daa] font-bold hover:underline"
                    >
                      <span className="material-symbols-outlined text-sm">visibility</span>
                      <span>Visualizar E-mail no Ethereal (Ambiente de Testes)</span>
                    </a>
                  </div>
                )}

                <div className="pt-2 border-t border-emerald-200">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotModalOpen(false);
                      setForgotSubmitted(false);
                      setForgotPreviewUrl(null);
                      setForgotResetUrl(null);
                    }}
                    className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-md cursor-pointer"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <p className="text-body-sm text-[#404753]">
                  Informe seu e-mail corporativo cadastrado para receber um link de redefinição de acesso.
                </p>
                <div>
                  <label className="font-label-bold text-[#191c1e] block mb-1">E-mail corporativo</label>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="seu.email@empresa.com.br"
                    className="w-full px-3.5 py-2.5 border border-[#c0c7d6] rounded-md font-body-md text-[#191c1e] outline-none focus:border-[#005daa]"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setForgotModalOpen(false)}
                    className="px-4 py-2 border border-[#c0c7d6] rounded-md font-label-bold text-[#404753] hover:bg-[#f2f4f6]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="px-4 py-2 bg-[#005daa] text-white rounded-md font-label-bold hover:bg-[#0075d5] disabled:opacity-60 flex items-center gap-1.5"
                  >
                    {forgotLoading ? (
                      <>
                        <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
                        <span>Enviando...</span>
                      </>
                    ) : (
                      'Enviar Link'
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
