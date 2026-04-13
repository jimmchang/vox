# Current Bridge Checkout Flow

## Step 1: Route Selection
User sees a table with 3 bridge routes side by side:
- Fast (2min, $4.50 fee)
- Standard (10min, $1.20 fee)  
- Economy (30min, $0.40 fee)

Each column shows: estimated time, fee, bridge protocol name, and a "Select" button. No explanation of what these routes are or why prices differ.

## Step 2: Token Approval
A modal appears saying "Approve USDC for bridging" with a "Confirm in wallet" button. No explanation of what approval means. If the user has already approved, they still see this step (no skip).

## Step 3: Transaction Confirmation
Shows raw transaction details: contract address, gas estimate in gwei, calldata preview, and a small "Confirm" button. Below that is a summary with the amounts, but it's below the fold on most screens.

## Step 4: Waiting
After confirming, the user sees "Transaction submitted" with a link to Etherscan. No progress indication. Users frequently open support tickets asking "where are my funds?" during the 2-30 minute bridging window.

## Known Issues
- Users don't understand the route selection table
- "Approve" step causes 40% of dropoffs — users think they're being scammed
- Raw transaction data scares non-technical users
- No progress tracking leads to support tickets
