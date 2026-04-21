"""
Vulnerable application logic for red-team testing.
All app behavior (auth, MFA, DB, uploads, fetch, chat context) lives here.
API layer (api/server.py) delegates to app.*; test suite uses HTTP only.
"""
