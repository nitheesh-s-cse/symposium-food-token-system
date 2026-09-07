# Symposium Food Token System

A real-time QR-based food token issuance and validation system designed for college symposiums.

## Features
- **Instant Token Verification**: QR scanning via camera with atomic PostgreSQL verification to prevent double redemption.
- **Real-Time Sync**: Server-Sent Events (SSE) automatically updates connected scanner devices and admin dashboards.
- **Role-Based Access**: Separate interfaces for Administrators (dashboard, analytics, student import/export) and Food Scanners.
- **Data Security**: Student phone numbers encrypted at rest (AES-256-GCM) with deterministic search hashing (HMAC-SHA256).

## Tech Stack
- **Framework**: Next.js 16 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS
- **Database & ORM**: PostgreSQL (Supabase), Drizzle ORM
- **Authentication**: JWT session cookies (Jose)
