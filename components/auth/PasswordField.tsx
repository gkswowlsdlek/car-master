"use client";

import { useState, type KeyboardEvent } from "react";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";

export function PasswordField({ label, value, onChange, autoComplete, placeholder, onKeyDown }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  placeholder?: string;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <label>{label}
      <span className="login-input-wrap password-input-wrap">
        <LockKeyhole size={17} />
        <input type={visible ? "text" : "password"} autoComplete={autoComplete} value={value} onChange={(event) => onChange(event.target.value)} onKeyDown={onKeyDown} placeholder={placeholder} />
        <button type="button" className="password-toggle-button" aria-label={visible ? "비밀번호 숨기기" : "비밀번호 표시"} onClick={() => setVisible((current) => !current)}>
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </span>
    </label>
  );
}
