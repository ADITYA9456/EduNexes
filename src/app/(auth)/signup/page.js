'use client';

import { useAuth } from '@/context/AuthProvider';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { HiAtSymbol, HiLockClosed, HiMail, HiPhone, HiUser } from 'react-icons/hi';

export default function SignupPage() {
  const { signUp, signInWithGoogle, sendPhoneOtp, verifyPhoneOtp } = useAuth();
  const router = useRouter();

  const [authMethod, setAuthMethod] = useState('email'); // 'email' | 'phone'
  const [form, setForm] = useState({ fullName: '', username: '', email: '', password: '', confirmPassword: '' });
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleEmailSignup = async (e) => {
    e.preventDefault();
    setError('');

    if (form.password.length < 6) return setError('Password must be at least 6 characters');
    if (form.password !== form.confirmPassword) return setError('Passwords do not match');

    setLoading(true);
    try {
      await signUp(form.email, form.password, {
        fullName: form.fullName,
        username: form.username,
      });
      setSuccess('Account created! Please check your email to confirm your account.');
    } catch (err) {
      setError(err.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!phone || phone.length < 10) {
      return setError('Please enter a valid phone number with country code (e.g. +91...)');
    }
    setLoading(true);
    try {
      await sendPhoneOtp(phone);
      setOtpSent(true);
      setSuccess('OTP sent! Check your phone.');
    } catch (err) {
      setError(err.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!otp || otp.length !== 6) {
      return setError('Please enter the 6-digit OTP');
    }
    setLoading(true);
    try {
      await verifyPhoneOtp(phone, otp);
      router.push('/home');
    } catch (err) {
      setError(err.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setError('');
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err.message || 'Google sign-in failed');
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card__header">
          <div className="auth-card__logo">🎓</div>
          <h2 className="auth-card__title">Create Account</h2>
          <p className="auth-card__subtitle">Join the learning revolution</p>
        </div>

        {error && <div className="form-error">{error}</div>}
        {success && <div className="form-success">{success}</div>}

        {/* Google Sign Up */}
        <button
          type="button"
          className="btn btn--social btn--google"
          onClick={handleGoogleSignup}
        >
          <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
          Continue with Google
        </button>

        <div className="auth-divider">
          <span>or sign up with</span>
        </div>

        {/* Auth Method Tabs */}
        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${authMethod === 'email' ? 'auth-tab--active' : ''}`}
            onClick={() => { setAuthMethod('email'); setError(''); setSuccess(''); }}
          >
            <HiMail size={16} /> Email
          </button>
          <button
            type="button"
            className={`auth-tab ${authMethod === 'phone' ? 'auth-tab--active' : ''}`}
            onClick={() => { setAuthMethod('phone'); setError(''); setSuccess(''); setOtpSent(false); }}
          >
            <HiPhone size={16} /> Phone
          </button>
        </div>

        {/* Email Signup Form */}
        {authMethod === 'email' && (
          <form className="auth-form" onSubmit={handleEmailSignup}>
            <div className="form-group">
              <label>Full Name</label>
              <div className="input-wrapper">
                <HiUser className="input-icon" size={18} />
                <input className="input input--with-icon" name="fullName" placeholder="John Doe" value={form.fullName} onChange={handleChange} required />
              </div>
            </div>

            <div className="form-group">
              <label>Username</label>
              <div className="input-wrapper">
                <HiAtSymbol className="input-icon" size={18} />
                <input className="input input--with-icon" name="username" placeholder="johndoe" value={form.username} onChange={handleChange} required />
              </div>
            </div>

            <div className="form-group">
              <label>Email</label>
              <div className="input-wrapper">
                <HiMail className="input-icon" size={18} />
                <input className="input input--with-icon" name="email" type="email" placeholder="you@example.com" value={form.email} onChange={handleChange} required />
              </div>
            </div>

            <div className="form-group">
              <label>Password</label>
              <div className="input-wrapper">
                <HiLockClosed className="input-icon" size={18} />
                <input className="input input--with-icon" name="password" type="password" placeholder="••••••••" value={form.password} onChange={handleChange} required />
              </div>
            </div>

            <div className="form-group">
              <label>Confirm Password</label>
              <div className="input-wrapper">
                <HiLockClosed className="input-icon" size={18} />
                <input className="input input--with-icon" name="confirmPassword" type="password" placeholder="••••••••" value={form.confirmPassword} onChange={handleChange} required />
              </div>
            </div>

            <button type="submit" className="btn btn--primary btn--lg" disabled={loading} style={{ width: '100%' }}>
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
        )}

        {/* Phone Signup Form */}
        {authMethod === 'phone' && (
          <>
            {!otpSent ? (
              <form className="auth-form" onSubmit={handleSendOtp}>
                <div className="form-group">
                  <label>Phone Number</label>
                  <div className="input-wrapper">
                    <HiPhone className="input-icon" size={18} />
                    <input
                      className="input input--with-icon"
                      type="tel"
                      placeholder="+91 9876543210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                    />
                  </div>
                  <span className="form-hint">Include country code (e.g. +91 for India)</span>
                </div>
                <button type="submit" className="btn btn--primary btn--lg" disabled={loading} style={{ width: '100%' }}>
                  {loading ? 'Sending OTP...' : 'Send OTP'}
                </button>
              </form>
            ) : (
              <form className="auth-form" onSubmit={handleVerifyOtp}>
                <div className="form-group">
                  <label>Enter OTP</label>
                  <div className="otp-input-group">
                    <input
                      className="input otp-input"
                      type="text"
                      maxLength={6}
                      placeholder="000000"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      required
                      autoFocus
                    />
                  </div>
                  <span className="form-hint">
                    Sent to {phone} &middot;{' '}
                    <button type="button" className="link-btn" onClick={() => { setOtpSent(false); setOtp(''); }}>
                      Change number
                    </button>
                  </span>
                </div>
                <button type="submit" className="btn btn--primary btn--lg" disabled={loading} style={{ width: '100%' }}>
                  {loading ? 'Verifying...' : 'Verify & Create Account'}
                </button>
              </form>
            )}
          </>
        )}

        <div className="auth-card__footer">
          Already have an account?{' '}
          <Link href="/login">Sign In</Link>
        </div>
      </div>
    </div>
  );
}
