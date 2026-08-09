# NNIT Cloud API

Railway-safe cloud control plane for NNIT Enterprise.

This service intentionally contains no Windows PowerShell/CIM/network adapter control.

Public:
- GET /api/health

Protected with x-nnit-api-key:
- GET /api/summary
- GET /api/devices
- POST /api/devices/register
- POST /api/devices/:id/heartbeat
- GET/POST /api/alerts
- GET/POST /api/analytics
- POST /api/commands
- GET /api/commands/device/:deviceId
- POST /api/commands/:id/result

Railway environment:
- NNIT_API_KEY
- CORS_ORIGIN (reserved for stricter production configuration)
- PORT is supplied by Railway

Version 0.1 uses in-memory storage. PostgreSQL persistence is the next production upgrade.
