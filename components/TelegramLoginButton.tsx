import React, { useEffect, useRef, useState } from 'react';
import { TelegramAuthUser, getTelegramConfig } from '../services/storageService';

interface TelegramLoginButtonProps {
  onAuth: (user: TelegramAuthUser) => void;
  disabled?: boolean;
}

// A unique global callback name per mounted button. The Telegram widget can only
// call a function on `window` by name (data-onauth), so we register one and route
// it back into React, then clean it up on unmount.
let callbackSeq = 0;

/**
 * Renders Telegram's official Login Widget.
 *
 * The bot @username comes from the backend (GET /auth/telegram/config) at runtime,
 * so no frontend build-time env var is needed. The bot's domain must be linked in
 * @BotFather via /setdomain. If login isn't configured server-side we render
 * nothing rather than a broken widget.
 */
const TelegramLoginButton: React.FC<TelegramLoginButtonProps> = ({ onAuth, disabled }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [botUsername, setBotUsername] = useState<string | null>(null);

  // Fetch the public widget config once on mount.
  useEffect(() => {
    let active = true;
    getTelegramConfig().then((cfg) => {
      if (active && cfg.enabled && cfg.bot_username) setBotUsername(cfg.bot_username);
    });
    return () => { active = false; };
  }, []);

  // Inject the widget once we know the bot username.
  useEffect(() => {
    if (!botUsername || !containerRef.current) return;

    const callbackName = `onTelegramAuth_${++callbackSeq}`;
    (window as any)[callbackName] = (user: TelegramAuthUser) => onAuth(user);

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', botUsername);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '8');
    script.setAttribute('data-request-access', 'write');
    script.setAttribute('data-onauth', `${callbackName}(user)`);

    const container = containerRef.current;
    container.appendChild(script);

    return () => {
      // Remove the injected widget (script + rendered iframe) and the global.
      container.innerHTML = '';
      delete (window as any)[callbackName];
    };
    // onAuth is intentionally not a dependency: the widget is created once and
    // reads onAuth through the stable global callback closure above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botUsername]);

  if (!botUsername) return null;

  return (
    // While disabled (e.g. a sign-in is in flight) we visually dim and block the
    // widget's iframe from receiving clicks.
    <div
      className={`flex justify-center transition-opacity ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
    >
      {/* rounded-lg + overflow-hidden clips the widget iframe's square corners so
          they don't show as dark triangles behind the rounded button. */}
      <div ref={containerRef} className="overflow-hidden rounded-lg leading-none" />
    </div>
  );
};

export default TelegramLoginButton;
