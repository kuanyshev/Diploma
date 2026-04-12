import "./Login.css";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import logo from "../assets/logo.png";
import { GoogleLogin } from "@react-oauth/google";
import {
  loginRequest,
  registerRequest,
  googleLoginRequest,
  setPasswordRequest,
  clearAuth,
  clearHabitKeysIfUserSwitched,
} from "../api";

export default function Login() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState(false);
  const [googleUserForContinue, setGoogleUserForContinue] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const persistSession = (data) => {
    if (data.user?.id != null) {
      clearHabitKeysIfUserSwitched(data.user.id);
    }
    if (data.access) localStorage.setItem("accessToken", data.access);
    if (data.refresh) localStorage.setItem("refreshToken", data.refresh);
    if (data.user?.username) {
      localStorage.setItem("userName", data.user.username);
    }
    if (data.user?.id != null) {
      localStorage.setItem("userId", String(data.user.id));
    }
  };

  const postAuthNavigate = (user) => {
    if (user?.onboarding_completed) {
      navigate("/dashboard", { replace: true });
    } else {
      navigate("/welcome", { replace: true });
    }
  };

  const handleSubmit = async () => {
    setError("");
    if (!password) {
      setError("Enter your password.");
      return;
    }
    if (isLogin) {
      if (!loginEmail.trim()) {
        setError("Enter your email.");
        return;
      }
      setLoading(true);
      try {
        const data = await loginRequest(loginEmail.trim(), password);
        persistSession(data);
        postAuthNavigate(data.user);
      } catch (e) {
        setError(e.message || "Login failed.");
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!username.trim()) {
      setError("Choose a username.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      clearAuth();
      await registerRequest({
        username: username.trim(),
        email: (email || "").trim(),
        password,
      });
      const data = await loginRequest(username.trim(), password);
      persistSession(data);
      postAuthNavigate(data.user);
    } catch (e) {
      setError(e.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleSavePassword = async () => {
    setError("");
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await setPasswordRequest(newPassword);
      setNeedsPasswordSetup(false);
      postAuthNavigate(googleUserForContinue);
    } catch (e) {
      setError(e.message || "Failed to save password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-box">
        <img src={logo} alt="SCOPOS" className="auth-logo-img" />

        {!isLogin && (
          <>
            <div className="google-btn" style={{ padding: 0 }}>
              <GoogleLogin
                onSuccess={async (credentialResponse) => {
                  try {
                    setLoading(true);
                    setError("");
                    clearAuth();
                    const cred = credentialResponse?.credential;
                    if (!cred) throw new Error("Missing Google credential.");
                    const data = await googleLoginRequest(cred, {
                      username: username.trim(),
                      password,
                    });
                    persistSession(data);
                    if (data.user?.has_password) {
                      postAuthNavigate(data.user);
                    } else {
                      setGoogleUserForContinue(data.user || null);
                      setNeedsPasswordSetup(true);
                    }
                  } catch (e) {
                    setError(e.message || "Google login failed.");
                  } finally {
                    setLoading(false);
                  }
                }}
                onError={() => setError("Google login failed.")}
                useOneTap={false}
              />
            </div>

            <div className="divider">
              <span>or</span>
            </div>
            <p style={{ fontSize: "0.8rem", color: "#666", margin: "6px 0 0" }}>
              Want to log in later without Google? Fill username + password first.
            </p>
          </>
        )}

        <div className="auth-form">
          <input
            className="auth-input"
            type={isLogin ? "email" : "text"}
            placeholder={isLogin ? "Email" : "Username"}
            value={isLogin ? loginEmail : username}
            onChange={(e) => (isLogin ? setLoginEmail(e.target.value) : setUsername(e.target.value))}
            autoComplete={isLogin ? "email" : "username"}
          />

          {!isLogin && (
            <input
              className="auth-input"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          )}

          <input
            className="auth-input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isLogin ? "current-password" : "new-password"}
          />

          {!isLogin && (
            <input
              className="auth-input"
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          )}

          {needsPasswordSetup && (
            <>
              <input
                className="auth-input"
                type="password"
                placeholder="Set password for future login"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
              <input
                className="auth-input"
                type="password"
                placeholder="Confirm new password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="submit-btn"
                disabled={loading}
                onClick={handleSavePassword}
              >
                {loading ? "…" : "Save password and continue"}
              </button>
            </>
          )}

          {isLogin && (
            <div className="forgot-row">
              <span>Forgot a password?</span>
            </div>
          )}

          {error ? (
            <p style={{ color: "#c44", fontSize: "0.9rem", margin: 0 }}>
              {error}
            </p>
          ) : null}

          <button
            type="button"
            className="submit-btn"
            disabled={loading || needsPasswordSetup}
            onClick={handleSubmit}
          >
            {loading ? "…" : isLogin ? "Log in" : "Create account"}
          </button>
        </div>

        <p className="bottom-text">
          {isLogin
            ? "Don't have a SCOPOS account?"
            : "Already have a SCOPOS account?"}{" "}
          <span
            onClick={() => {
              setIsLogin(!isLogin);
              setError("");
            }}
          >
            {isLogin ? "Register" : "Log in"}
          </span>
        </p>
      </div>
    </div>
  );
}
