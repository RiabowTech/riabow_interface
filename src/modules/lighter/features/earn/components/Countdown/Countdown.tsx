import { Trans } from "@lingui/macro";
import { useEffect, useRef, useState } from "react";

import "./Countdown.css";

interface CountdownProps {
  endTime: number; // Unix timestamp in milliseconds
  showDays?: boolean; // Whether to show days (for live status)
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function calculateTimeLeft(endTime: number): TimeLeft {
  const now = Date.now();
  const difference = endTime - now;

  if (difference <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  }

  const days = Math.floor(difference / (1000 * 60 * 60 * 24));
  const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((difference % (1000 * 60)) / 1000);

  return { days, hours, minutes, seconds };
}

export function Countdown({ endTime, showDays = false }: CountdownProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => calculateTimeLeft(endTime));
  
  // Store the last non-zero angles to prevent the hands from rotating back to 0
  const lastMinuteAngle = useRef<number>(0);
  const lastSecondAngle = useRef<number>(0);

  useEffect(() => {
    const timer = setInterval(() => {
      const newTimeLeft = calculateTimeLeft(endTime);
      setTimeLeft(newTimeLeft);

      // Stop the timer if countdown reaches zero
      if (newTimeLeft.days === 0 && newTimeLeft.hours === 0 && newTimeLeft.minutes === 0 && newTimeLeft.seconds === 0) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [endTime]);

  // Calculate rotation angles for clock hands
  const isEnded = timeLeft.days === 0 && timeLeft.hours === 0 && timeLeft.minutes === 0 && timeLeft.seconds === 0;
  
  // Calculate current angles
  const currentMinuteAngle = (timeLeft.minutes / 60) * 360;
  const currentSecondAngle = (timeLeft.seconds / 60) * 360;
  
  // Update last angles only if not ended and time is not zero
  if (!isEnded && (timeLeft.minutes > 0 || timeLeft.seconds > 0)) {
    lastMinuteAngle.current = currentMinuteAngle;
    lastSecondAngle.current = currentSecondAngle;
  }
  
  // Use last angles when ended to prevent rotation back to 0
  const minuteAngle = isEnded ? lastMinuteAngle.current : currentMinuteAngle;
  const secondAngle = isEnded ? lastSecondAngle.current : currentSecondAngle;

  return (
    <div className="countdown-container">
      <div className="countdown-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="8.5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
          {/* Hour hand (minute indicator) - shorter, thicker */}
          <line
            x1="10"
            y1="10"
            x2="10"
            y2="5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            style={{
              transformOrigin: '10px 10px',
              transform: `rotate(${minuteAngle}deg)`,
              transition: isEnded ? 'none' : 'transform 0.1s ease-out'
            }}
          />
          {/* Minute hand (second indicator) - longer, thinner */}
          <line
            x1="10"
            y1="10"
            x2="10"
            y2="3.5"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            style={{
              transformOrigin: '10px 10px',
              transform: `rotate(${secondAngle}deg)`,
              transition: isEnded ? 'none' : 'transform 0.1s ease-out'
            }}
          />
          <circle cx="10" cy="10" r="1" fill="currentColor"/>
        </svg>
      </div>
      <span className="countdown-label">
        <Trans>Time Remaining</Trans>
      </span>
      <div className="countdown-time">
        {showDays && timeLeft.days > 0 && (
          <>
            <span className="countdown-number">{timeLeft.days}d</span>
            <span className="countdown-separator"> - </span>
          </>
        )}
        <span className="countdown-number">
          {showDays 
            ? String(timeLeft.hours).padStart(2, "0")
            : String(timeLeft.days * 24 + timeLeft.hours).padStart(2, "0")
          }
        </span>
        <span className="countdown-separator">:</span>
        <span className="countdown-number">{String(timeLeft.minutes).padStart(2, "0")}</span>
        <span className="countdown-separator">:</span>
        <span className="countdown-number">{String(timeLeft.seconds).padStart(2, "0")}</span>
      </div>
    </div>
  );
}

