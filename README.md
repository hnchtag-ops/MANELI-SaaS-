# 🚀 MANELI SaaS Kernel

A high-performance SaaS core application built with TypeScript, Node.js, and PL/pgSQL, integrated with Google AI Studio APIs for automated backend intelligence and workflow execution.

---

## 🛠️ Tech Stack & Architecture

* **Languages:** TypeScript (94.3%), PL/pgSQL (5.3%), SQL
* **Backend & Server:** Node.js, `server.ts`, TypeScript Middleware (`middleware.ts`)
* **AI Integration:** Google AI Studio / Gemini API (`assets/.aistudio`)
* **Build Tooling:** Vite (`vite.config.ts`), Bun (`bun.lock`)
* **Database:** PostgreSQL / PL/pgSQL procedures

---

## 🔑 Key Features

* **AI-Enabled Workflows:** Integrated Google AI Studio API for real-time model prompting and dynamic data synthesis.
* **Authentication & API Middleware:** Custom authentication routing (`app/api/auth`) and middleware guards for secure endpoint access.
* **Database Management:** Optimized PL/pgSQL routines for high-speed data handling and transactional operations.

---

## ⚙️ Local Development Setup

### Prerequisites
* Node.js (v18+)
* Bun or NPM

### Installation
1. Clone the repository:
   ```bash
   git clone [https://github.com/hnchtag-ops/MANELI-SaaS-.git](https://github.com/hnchtag-ops/MANELI-SaaS-.git)
   cd MANELI-SaaS-
