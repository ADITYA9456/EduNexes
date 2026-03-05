'use client';

import { useEffect, useState } from 'react';

/**
 * Countdown timer for contests.
 * @param {{ targetDate: string }} props
 */
export default function CountdownTimer({ targetDate }) {
  const [timeLeft, setTimeLeft] = useState(calcTimeLeft(targetDate));

  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(calcTimeLeft(targetDate)), 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  if (timeLeft.total <= 0) return <span className="badge badge--hard">Ended</span>;

  return (
    <span className="contest-card__timer">
      {timeLeft.days > 0 && `${timeLeft.days}d `}
      {String(timeLeft.hours).padStart(2, '0')}:
      {String(timeLeft.minutes).padStart(2, '0')}:
      {String(timeLeft.seconds).padStart(2, '0')}
    </span>
  );
}

function calcTimeLeft(target) {
  const total = Math.max(0, new Date(target) - Date.now());
  return {
    total,
    days: Math.floor(total / (1000 * 60 * 60 * 24)),
    hours: Math.floor((total / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((total / (1000 * 60)) % 60),
    seconds: Math.floor((total / 1000) % 60),
  };
}
