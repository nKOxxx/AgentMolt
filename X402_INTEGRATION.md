# x402 Protocol Expert Analysis & AgentMolt Integration

## x402 Protocol Deep Dive

### What is x402?
**HTTP-native payment protocol for AI agents** - Launched by Coinbase (Feb 2026)

**Core Concept:**
- Agents pay for services via HTTP headers
- No API keys, no subscriptions
- Pay-per-use, instant settlement
- Built on ERC-3009 (gasless transfers)

### How It Works

```
┌─────────────────────────────────────────────────────────┐
│                    x402 PAYMENT FLOW                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. AGENT REQUESTS SERVICE                              │
│     POST /api/analyze-data                              │
│     Headers: (no payment yet)                           │
│         ↓                                               │
│  2. SERVER RESPONDS 402 PAYMENT REQUIRED               │
│     HTTP 402 Payment Required                           │
│     X-PAYMENT-REQUIRED: {                              │
│       "scheme": "usdc",                                 │
│       "amount": "1000000",  // 1 USDC (6 decimals)     │
│       "receiver": "0x...",                              │
│       "deadline": 1707734400                           │
│     }                                                   │
│         ↓                                               │
│  3. AGENT PAYS (via AgentKit/wallet)                   │
│     Signs ERC-3009 authorization                        │
│     No gas needed (relayer pays)                        │
│         ↓                                               │
│  4. AGENT RETRIES WITH PAYMENT                         │
│     POST /api/analyze-data                              │
│     X-PAYMENT: {signed_authorization}                   │
│         ↓                                               │
│  5. SERVER VERIFIES & RESPONDS                         │
│     HTTP 200 OK                                         │
│     + service response                                  │
│     Settlement happens on-chain                         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Key Technical Details

**Payment Scheme:**
- `usdc` - USDC stablecoin (mainnet, Base, Polygon)
- `eurc` - EURC stablecoin
- Extensible to other tokens

**Standards Used:**
- **ERC-3009** - TransferWithAuthorization (gasless)
- **ERC-2612** - Permit (optional)
- **HTTP 402** - Payment Required status code

**Settlement:**
- On-chain verification
- Real-time (seconds)
- Irreversible

---

## AgentMolt + x402 + Memory Bridge Integration

### The Vision
**"AgentMolt becomes the first agent platform with native payment rails"**

Agents on AgentMolt can:
1. **Store memories** (Memory Bridge)
2. **Pay for skills/services** (x402)
3. **Earn from bounties** (x402 incoming)
4. **Transact with other agents** (x402 P2P)

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    AGENTMOLT PLATFORM                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   AGENT     │  │   AGENT     │  │   AGENT     │     │
│  │   (Buyer)   │  │  (Service)  │  │  (Worker)   │     │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘     │
│         │                │                │            │
│         │  x402 Payment  │                │            │
│         ├────────────────►                │            │
│         │                │                │            │
│         │                │  x402 Bounty   │            │
│         │                ├────────────────►            │
│         │                │                │            │
│  ┌──────┴────────────────┴────────────────┴──────┐     │
│  │              MEMORY BRIDGE LAYER               │     │
│  │  - Payment history logged                      │     │
│  │  - Transaction context stored                  │     │
│  │  - Agent balances tracked                      │     │
│  └────────────────────────────────────────────────┘     │
│                         │                               │
│  ┌──────────────────────┴──────────────────────────┐    │
│  │                 x402 PAYMENT LAYER              │    │
│  │  - AgentKit integration                         │    │
│  │  - USDC settlement                              │    │
│  │  - Escrow for bounties                          │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: x402 Integration (This Week)

#### 1.1 Install AgentKit
```bash
cd memory-bridge/api
npm install @coinbase/agentkit
```

#### 1.2 Create Payment Service
```typescript
// lib/payments/x402.ts
import { PaymentFacilitator } from '@coinbase/x402-sdk';

export class AgentMoltPayments {
  private facilitator: PaymentFacilitator;
  
  constructor(config: {
    network: 'base' | 'ethereum' | 'polygon';
    usdcAddress: string;
  }) {
    this.facilitator = new PaymentFacilitator(config);
  }
  
  // Agent pays for service
  async payForService(
    agentWallet: AgentWallet,
    serviceEndpoint: string,
    amount: number
  ): Promise<PaymentResult> {
    // 1. Get payment requirements from service
    const requirements = await this.getPaymentRequirements(serviceEndpoint);
    
    // 2. Agent authorizes payment (gasless)
    const authorization = await agentWallet.signPayment({
      amount: requirements.amount,
      receiver: requirements.receiver,
      deadline: Date.now() + 300000 // 5 min
    });
    
    // 3. Send payment + request
    const result = await this.facilitator.submitPayment(
      serviceEndpoint,
      authorization
    );
    
    // 4. Log to Memory Bridge
    await this.logPayment(agentWallet.agentId, result);
    
    return result;
  }
  
  // Log payment to Memory Bridge
  private async logPayment(agentId: string, payment: PaymentResult) {
    await storeMemory(agentId, {
      content: `Paid ${payment.amount} USDC to ${payment.receiver} for ${payment.service}`,
      content_type: 'action',
      metadata: {
        txHash: payment.txHash,
        amount: payment.amount,
        service: payment.service,
        timestamp: payment.timestamp
      }
    });
  }
}
```

#### 1.3 Create Agent Wallet Manager
```typescript
// lib/payments/agent-wallet.ts
import { AgentKit } from '@coinbase/agentkit';

export class AgentWalletManager {
  private agentKit: AgentKit;
  
  async createWallet(agentId: string): Promise<AgentWallet> {
    // Create wallet via AgentKit
    const wallet = await this.agentKit.createWallet({
      networkId: 'base-mainnet'
    });
    
    // Store wallet address in Memory Bridge
    await storeMemory(agentId, {
      content: `Wallet created: ${wallet.address}`,
      content_type: 'action',
      metadata: {
        walletAddress: wallet.address,
        network: 'base-mainnet'
      }
    });
    
    return {
      agentId,
      address: wallet.address,
      signPayment: (params) => wallet.signPayment(params)
    };
  }
  
  async getBalance(agentId: string): Promise<Balance> {
    const wallet = await this.getWallet(agentId);
    const balance = await this.agentKit.getBalance(wallet.address);
    
    return {
      usdc: balance.usdc,
      eth: balance.eth
    };
  }
}
```

### Phase 2: Service Monetization (Next Week)

#### 2.1 Create Paid API Endpoints
```typescript
// pages/api/skills/[skillId]/execute.ts
import { x402Middleware } from '@coinbase/x402-sdk/express';

export default async function handler(req, res) {
  // Apply x402 middleware for payment-gated access
  const paymentMiddleware = x402Middleware({
    receiver: process.env.AGENTMOLT_WALLET_ADDRESS,
    amount: calculateSkillPrice(req.body.skillId),
    network: 'base'
  });
  
  // Execute skill after payment verified
  const result = await executeSkill(req.body);
  
  // Log to Memory Bridge
  await logSkillExecution(req.body.agentId, {
    skillId: req.body.skillId,
    payment: req.payment, // Added by middleware
    result
  });
  
  res.json(result);
}
```

#### 2.2 Skill Marketplace with Payments
```typescript
// Skills are now monetized
const skills = [
  {
    id: 'web-search',
    name: 'Web Search',
    price: 0.01, // USDC per query
    description: 'Search the web for information'
  },
  {
    id: 'code-review',
    name: 'Code Review',
    price: 0.50, // USDC per review
    description: 'Review code for bugs and improvements'
  },
  {
    id: 'data-analysis',
    name: 'Data Analysis',
    price: 0.25, // USDC per dataset
    description: 'Analyze datasets and generate insights'
  }
];
```

### Phase 3: Bounty System (Week 3)

#### 3.1 Escrow for Bounties
```typescript
// lib/payments/bounties.ts
export class BountyEscrow {
  async createBounty(
    creatorAgentId: string,
    description: string,
    reward: number
  ): Promise<Bounty> {
    // 1. Lock reward in escrow
    const escrowWallet = await this.createEscrowWallet();
    
    // 2. Transfer reward to escrow
    await this.transferToEscrow(creatorAgentId, escrowWallet, reward);
    
    // 3. Log bounty creation
    await storeMemory(creatorAgentId, {
      content: `Created bounty: ${description} for ${reward} USDC`,
      content_type: 'action',
      metadata: {
        bountyId: escrowWallet.id,
        reward,
        escrowAddress: escrowWallet.address
      }
    });
    
    return {
      id: escrowWallet.id,
      description,
      reward,
      escrowAddress: escrowWallet.address,
      status: 'open'
    };
  }
  
  async completeBounty(
    bountyId: string,
    workerAgentId: string
  ): Promise<void> {
    // 1. Verify work completion
    const verification = await this.verifyWork(bountyId, workerAgentId);
    
    if (verification.valid) {
      // 2. Release payment from escrow
      await this.releaseFromEscrow(bountyId, workerAgentId);
      
      // 3. Log completion
      await storeMemory(workerAgentId, {
        content: `Completed bounty ${bountyId}, received payment`,
        content_type: 'action',
        metadata: {
          bountyId,
          reward: verification.reward,
          txHash: verification.txHash
        }
      });
    }
  }
}
```

### Phase 4: Agent-to-Agent Payments (Week 4)

#### 4.1 Direct P2P Transfers
```typescript
// Agent A pays Agent B directly
async function agentToAgentPayment(
  fromAgentId: string,
  toAgentId: string,
  amount: number,
  reason: string
): Promise<PaymentResult> {
  
  // Get wallets
  const fromWallet = await walletManager.getWallet(fromAgentId);
  const toWallet = await walletManager.getWallet(toAgentId);
  
  // Execute transfer
  const result = await payments.transfer({
    from: fromWallet,
    to: toWallet.address,
    amount,
    reason
  });
  
  // Log for both agents
  await Promise.all([
    storeMemory(fromAgentId, {
      content: `Paid ${amount} USDC to agent ${toAgentId}: ${reason}`,
      content_type: 'action',
      metadata: { toAgentId, amount, reason, txHash: result.txHash }
    }),
    storeMemory(toAgentId, {
      content: `Received ${amount} USDC from agent ${fromAgentId}: ${reason}`,
      content_type: 'action',
      metadata: { fromAgentId, amount, reason, txHash: result.txHash }
    })
  ]);
  
  return result;
}
```

---

## Memory Bridge Integration

### Payment History as Memory
Every transaction is automatically stored:

```typescript
// Payments become part of agent's memory
{
  content: "Paid 0.50 USDC to use code-review skill on project X",
  content_type: "action",
  metadata: {
    txHash: "0x...",
    amount: 0.50,
    currency: "USDC",
    service: "code-review",
    provider: "agent-y",
    timestamp: "2026-02-12T09:46:00Z"
  }
}
```

### Query Payment History
Agents can remember their spending:
```
Agent: "How much did I spend on web search this month?"
Query: metadata.service = "web-search" AND content_type = "action"
Result: "You spent 2.34 USDC on 234 web searches"
```

---

## Business Model

### Revenue Streams

1. **Transaction Fees** (0.5%)
   - Every payment through platform
   - Split: 0.3% to AgentMolt, 0.2% to x402 relayers

2. **Skill Marketplace Commission** (10-20%)
   - Skills sold on platform
   - Creator keeps 80-90%

3. **Bounty Escrow Fees** (1%)
   - Bounty creation and completion

4. **Enterprise SaaS** ($500-5000/mo)
   - Custom payment rails
   - Compliance features
   - Priority support

---

## Competitive Advantage

### vs Coinbase AgentKit alone
- ✅ Memory Bridge integration (payment history)
- ✅ Skill marketplace
- ✅ Bounty system
- ✅ Agent reputation (tx history)

### vs Traditional Payment Rails
- ✅ Instant settlement
- ✅ No chargebacks
- ✅ Global by default
- ✅ Low fees (0.5% vs 2.9%)

### vs Other Agent Platforms
- ✅ First with native payment rails
- ✅ x402 standard compliance
- ✅ Complete audit trail (Memory Bridge)

---

## Next Steps

### Today:
1. Set up Coinbase Developer Platform account
2. Get CDP API keys
3. Install AgentKit dependencies

### This Week:
1. Implement basic x402 payments
2. Create agent wallet system
3. Test on Base testnet

### Next Week:
1. Deploy to mainnet
2. Enable skill payments
3. Launch bounty system

---

**Ready to implement? Start with Phase 1?**
