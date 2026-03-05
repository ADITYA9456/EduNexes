'use client';

import { useAuth } from '@/context/AuthProvider';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { HiAtSymbol, HiLockClosed, HiMail, HiUser } from 'react-icons/hi';

export default function SignupPage() {
  const { signUp } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState({ fullName: '', username: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
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
      router.push('/home');
    } catch (err) {
      setError(err.message || 'Signup failed');
    } finally {
      setLoading(false);
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

        <form className="auth-form" onSubmit={handleSubmit}>
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

        <div className="auth-card__footer">
          Already have an account?{' '}
          <Link href="/login">Sign In</Link>
        </div>
      </div>
    </div>
  );
}
