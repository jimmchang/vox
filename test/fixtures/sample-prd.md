# PRD: DeFi Bridge Checkout Redesign

## Overview

Redesign the bridge checkout flow to reduce abandonment and increase successful cross-chain transfers. Currently, 68% of users who start a bridge transaction abandon before completing it.

## Proposed Changes

### 1. Route Selection (simplified)
Replace the current 3-column route comparison table with a single recommended route and an "Advanced options" expandable section. Show estimated time and fee prominently. Add a tooltip explaining what a bridge route is.

### 2. Token Approval
Add a clear explanation of what token approval means and why it's needed. Show a progress indicator ("Step 1 of 3"). Allow users to skip if they've already approved.

### 3. Transaction Confirmation
Show a plain-language summary: "You're sending 100 USDC from Ethereum to Arbitrum. You'll receive ~99.20 USDC in about 2 minutes. Fee: $0.80."
Remove the raw transaction data that's currently shown by default.

### 4. Status Tracking
Replace the current block explorer link with an in-app progress bar showing: Submitted → Confirmed on source → Bridging → Received on destination.

## Target Metrics
- Bridge completion rate (currently 32%, target 60%)
- Support tickets about bridging (currently ~50/week, target <20/week)
- Time to complete bridge (currently avg 8 minutes of active user time, target <3 minutes)
