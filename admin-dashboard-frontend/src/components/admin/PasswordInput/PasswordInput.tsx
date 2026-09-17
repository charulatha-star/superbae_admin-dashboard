"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import styles from "./PasswordInput.module.css";

type PasswordInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
};

export default function PasswordInput({ label, ...inputProps }: PasswordInputProps) {
  const [show, setShow] = useState(false);

  return (
    <div className={styles.container}>
      {label && <label className={styles.label}>{label}</label>}
      <div className={styles.inputWrapper}>
        <input
          {...inputProps}
          type={show ? "text" : "password"}
          className={styles.input}
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className={styles.toggleBtn}
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      </div>
    </div>
  );
}
