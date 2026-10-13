# Preuve B0 — un seul fournisseur de connexion : Google

Spec § 3.2 et § 7.2. Cette preuve est une **capture d'écran** : les réglages des fournisseurs ne sont pas dans la
base, aucune requête SQL ne peut les lire.

## Ce que la capture doit montrer

Page **Authentication → Providers** (ou **Sign In / Providers**) du projet, montrant :

- **Google** : *activé* (le seul) ;
- **Email** : *désactivé* — ni mot de passe, ni *magic link*, ni OTP ;
- **Phone** : *désactivé* ;
- **Anonymous sign-ins** : *désactivé* ;
- **Confirm email** : *activé* ;
- **Automatic linking** (liaison automatique d'identités) : *désactivé*.

## À remplir par Neegan

| Projet | Date | Google | Email | Phone | Anonymous | Confirm email | Linking auto | Capture |
|---|---|---|---|---|---|---|---|---|
| `mitsu` (seul projet, D8 révoquée) | 13 octobre 2026, 15 h 11 | activé (client OAuth du projet Google Cloud `cuisine-os-neegan`, écran de consentement External en statut Testing, deux Test users) | désactivé | désactivé | désactivé | activé | désactivé (« Allow manual linking » éteint) | Captures sur le Mac de Neegan (`… 15.07.44.png` : User Signups ; `… 15.10.18.png` : panneau Google ; `… 15.11.29.png` : panneau Email éteint). **Contre-preuve par l'API publique** le même jour à 15 h 14 (`GET /auth/v1/settings` avec la clé publique) : `external` actifs = `["google"]` seulement ; `email: false`, `phone: false`, `anonymous: false`, `mailer_autoconfirm: false` (= Confirm email activé). |

## Pourquoi chaque ligne compte

Une seule porte ouverte suffit à contourner la liste d'adresses autorisées : un compte créé par mot de passe, par
*magic link* ou en anonyme arriverait dans `auth.users` par un chemin que le crochet « Before User Created » surveille
aussi, mais avec une adresse choisie par la personne elle-même. La liaison automatique d'identités, elle, rattacherait
une identité d'un autre fournisseur à un compte existant sur la seule foi de l'adresse. Ces réglages sont la barrière
**B0** ; la liste `private.allowed_users` est **B1**. Les deux, pas l'une ou l'autre.
