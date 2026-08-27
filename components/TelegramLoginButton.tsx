import React, { useEffect, useRef } from 'react';
import { TelegramAuthUser } from '../services/storageService';

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
 * Requires VITE_TELEGRAM_BOT_USERNAME (the bot's @username, without the @) and the
 * bot's domain to be linked in @BotFather via /setdomain. If the env var is
 * missing we render nothing rather than a broken widget.
 */
const TelegramLoginButton: React.FC<TelegramLoginButtonProps> = ({ onAuth, disabled }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const botUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME as string | undefined;

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
      <div ref={containerRef} />
    </div>
  );
};

export default TelegramLoginButton;
