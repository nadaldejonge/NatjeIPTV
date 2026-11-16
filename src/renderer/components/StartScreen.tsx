import type { ReactElement } from "react";
import { FolderOpen, Link, Loader2, LogIn, Square, SquareCheck } from "lucide-react";
import type { XtreamCredentials } from "../../shared/xtream";
import TvTextInput from "./TvTextInput";
import BrandImage from "./BrandImage";

type Props = {
  credentials: XtreamCredentials;
  playlistUrl: string;
  status: string;
  buildLabel?: string;
  loadState: "idle" | "loading" | "ready" | "error";
  tvMode?: boolean;
  rememberLogin?: boolean;
  onRememberLoginChange?: (value: boolean) => void;
  onCredentialsChange: (credentials: XtreamCredentials) => void;
  onPlaylistUrlChange: (value: string) => void;
  onXtreamLogin: () => void;
  onOpenFile: () => void;
  onLoadUrl: () => void;
};

export default function StartScreen(props: Props): ReactElement {
  const isLoading = props.loadState === "loading";
  const tv = Boolean(props.tvMode);

  return (
    <main className={tv ? "start-screen tv-start-screen" : "start-screen"}>
      <section className={tv ? "login-card tv-login-card" : "login-card"}>
        <div className="login-brand">
          <div className="brand-mark">
            <BrandImage />
          </div>
          <div>
            <h1>Natje&apos;s IPTV-player</h1>
            <span>Login lokaal. Speel snel. Hou overzicht.</span>
            {props.buildLabel && <em className="tv-build-badge">{props.buildLabel}</em>}
          </div>
        </div>

        <div className="login-grid">
          <section className="login-section primary">
            <div className="section-heading">
              <LogIn size={20} />
              <h2>Xtream login</h2>
            </div>
            {tv ? (
              <>
                <TvTextInput
                  value={props.credentials.serverUrl}
                  onChange={(value) => props.onCredentialsChange({ ...props.credentials, serverUrl: value })}
                  disabled={isLoading}
                  placeholder="Server URL, bijv. http://provider.nl:8080"
                />
                <TvTextInput
                  value={props.credentials.username}
                  onChange={(value) => props.onCredentialsChange({ ...props.credentials, username: value })}
                  disabled={isLoading}
                  placeholder="Username"
                />
                <TvTextInput
                  value={props.credentials.password}
                  onChange={(value) => props.onCredentialsChange({ ...props.credentials, password: value })}
                  disabled={isLoading}
                  placeholder="Password"
                  type="password"
                />
                <button
                  className="remember-toggle"
                  onClick={() => props.onRememberLoginChange?.(!(props.rememberLogin ?? true))}
                  disabled={isLoading}
                >
                  {(props.rememberLogin ?? true) ? <SquareCheck size={18} /> : <Square size={18} />}
                  Login onthouden
                </button>
              </>
            ) : (
              <>
                <input
                  value={props.credentials.serverUrl}
                  onChange={(event) => props.onCredentialsChange({ ...props.credentials, serverUrl: event.target.value })}
                  disabled={isLoading}
                  placeholder="Server URL, bijv. http://provider.nl:8080"
                />
                <input
                  value={props.credentials.username}
                  onChange={(event) => props.onCredentialsChange({ ...props.credentials, username: event.target.value })}
                  disabled={isLoading}
                  placeholder="Username"
                />
                <input
                  value={props.credentials.password}
                  onChange={(event) => props.onCredentialsChange({ ...props.credentials, password: event.target.value })}
                  disabled={isLoading}
                  placeholder="Password"
                  type="password"
                />
              </>
            )}
            <button onClick={props.onXtreamLogin} disabled={isLoading}>
              {isLoading ? <Loader2 className="spin" size={18} /> : <LogIn size={18} />}
              {isLoading ? "Verbinden" : "Login"}
            </button>
          </section>

          <section className="login-section">
            <div className="section-heading">
              <Link size={20} />
              <h2>M3U fallback</h2>
            </div>
            {tv ? (
              <TvTextInput
                value={props.playlistUrl}
                onChange={props.onPlaylistUrlChange}
                disabled={isLoading}
                placeholder="https://voorbeeld.nl/playlist.m3u8"
              />
            ) : (
              <input
                value={props.playlistUrl}
                onChange={(event) => props.onPlaylistUrlChange(event.target.value)}
                disabled={isLoading}
                placeholder="https://voorbeeld.nl/playlist.m3u8"
              />
            )}
            <div className="split-actions">
              <button onClick={props.onOpenFile} disabled={isLoading}>
                <FolderOpen size={18} />
                Bestand
              </button>
              <button onClick={props.onLoadUrl} disabled={isLoading}>
                <Link size={18} />
                URL
              </button>
            </div>
          </section>
        </div>

        <div className={props.loadState === "error" ? "login-status error" : "login-status"}>
          {isLoading && (
            <span className="mini-loader">
              <i />
              <i />
              <i />
            </span>
          )}
          {props.status}
        </div>
      </section>
    </main>
  );
}
