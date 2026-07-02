# Logowanie i sesja 🔐

Aplikacja demonstrująca uwierzytelnianie na **Supabase Auth**: rejestracja, logowanie,
trasa dostępna dopiero po zalogowaniu (`#/dashboard`) oraz wylogowanie kończące sesję.

**Live:** https://gabipaw.github.io/auth/

## Co robi
- **Rejestracja** i **logowanie** e-mailem i hasłem.
- Hasła są **hashowane po stronie Supabase (bcrypt)** — front nigdy ich nie przechowuje.
- **Trasa chroniona** `#/dashboard`: bez ważnej sesji następuje przekierowanie na logowanie.
- **Sesja** trzymana w `localStorage`, więc przetrwa odświeżenie i nową kartę; token jest
  walidowany po stronie serwera (`/auth/v1/user`) przy każdym wejściu na panel.
- **Wylogowanie** czyści sesję lokalnie i po stronie GoTrue (`/auth/v1/logout`).
- Czytelne komunikaty: „Nieprawidłowy e-mail lub hasło", „Konto z tym adresem już istnieje".

## Konto testowe
Dane logowania do gotowego konta testowego przekazuję w **notatce przy oddaniu zadania**
(nie umieszczam ich w publicznym repo). Możesz też założyć własne konto przez formularz rejestracji.

## Technologie
- Czysty HTML/CSS/JS (SPA z routingiem po `location.hash`).
- Supabase Auth (GoTrue) przez REST.
- Testy e2e: Playwright (Supabase mockowany przez `page.route`).

## Uruchomienie lokalnie
```bash
python3 -m http.server 4173      # potem otwórz http://127.0.0.1:4173
npm install && npm run test:e2e  # testy e2e
```

Klucz `anon` w `config.js` jest publiczny (chroniony przez polityki Supabase) — to nie sekret.
