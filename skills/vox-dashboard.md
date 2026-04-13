---
name: vox-dashboard
description: Start, stop, or check the status of the Vox dashboard web server
allowed-tools: Bash
---

# /vox-dashboard — Dashboard Lifecycle

Manage the Vox dashboard Next.js server.

## Usage

When invoked, check the current state and offer options:

### Check if running

```bash
lsof -ti:3000 2>/dev/null
```

### Start

If not running:

```bash
npm run dev &
```

Wait for the server to be ready, then report:

```
Dashboard running at http://localhost:3000
```

### Stop

If running:

```bash
kill $(lsof -ti:3000) 2>/dev/null
```

Report: "Dashboard stopped."

### Status

Report whether the server is running and on which port.
