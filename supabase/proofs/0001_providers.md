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
| `mistu-dev` | | activé | désactivé | désactivé | désactivé | activé | désactivé | [capture à coller par Neegan] |
| `mistu` | | activé | désactivé | désactivé | désactivé | activé | désactivé | [capture à coller par Neegan] |

## Pourquoi chaque ligne compte

Une seule porte ouverte suffit à contourner la liste d'adresses autorisées : un compte créé par mot de passe, par
*magic link* ou en anonyme arriverait dans `auth.users` par un chemin que le crochet « Before User Created » surveille
aussi, mais avec une adresse choisie par la personne elle-même. La liaison automatique d'identités, elle, rattacherait
une identité d'un autre fournisseur à un compte existant sur la seule foi de l'adresse. Ces réglages sont la barrière
**B0** ; la liste `private.allowed_users` est **B1**. Les deux, pas l'une ou l'autre.
