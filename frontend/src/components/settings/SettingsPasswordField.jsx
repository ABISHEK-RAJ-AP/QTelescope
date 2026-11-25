import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export function SettingsPasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
}) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="us-field us-field--password" htmlFor={id}>
      <span className="us-field__label">{label}</span>
      <span className="us-password-wrap">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          placeholder={placeholder}
          onChange={onChange}
        />
        <button
          type="button"
          className="us-password-wrap__toggle"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
        </button>
      </span>
    </label>
  );
}