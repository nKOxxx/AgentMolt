import { AgentKit } from '@coinbase/agentkit';
import { PaymentFacilitator } from '@coinbase/x402-sdk';
import { storeMemory } from './memory-simple.js';

/**
 * AgentMolt Payment System
 * Integrates x402 protocol for agent-to-agent payments
 */

export class AgentMoltPayments {
  private agentKit: AgentKit;
  private facilitator: PaymentFacilitator;
  private network: string;
  
  constructor(config: {
    cdpApiKey: string;
    cdpApiSecret: string;
    network?: 'base-mainnet' | 'base-sepolia' | 'ethereum';
  }) {
    this.network = config.network || 'base-sepolia'; // Default to testnet
    
    // Initialize AgentKit
    this.agentKit = new AgentKit({
      cdpApiKey: config.cdpApiKey,
      cdpApiSecret: config.cdpApiSecret
    });
    
    // Initialize x402 facilitator
    this.facilitator = new PaymentFacilitator({
      network: this.network
    });
  }
  
  /**
   * Create a wallet for an agent
   */
  async createAgentWallet(agentId: string): Promise<AgentWallet> {
    try {
      // Create wallet via AgentKit
      const wallet = await this.agentKit.createWallet({
        networkId: this.network
      });
      
      // Store wallet info in Memory Bridge
      await this.logToMemory(agentId, {
        content: `Wallet created on ${this.network}: ${wallet.address}`,
        content_type: 'action',
        metadata: {
          walletAddress: wallet.address,
          network: this.network,
          action: 'wallet_created'
        }
      });
      
      return {
        agentId,
        address: wallet.address,
        network: this.network,
        getBalance: () => this.getBalance(wallet.address),
        signPayment: (params) => this.signPayment(wallet, params)
      };
    } catch (error) {
      console.error('Failed to create agent wallet:', error);
      throw error;
    }
  }
  
  /**
   * Get wallet balance
   */
  async getBalance(address: string): Promise<WalletBalance> {
    try {
      const balance = await this.agentKit.getBalance({
        address,
        networkId: this.network
      });
      
      return {
        usdc: parseFloat(balance.usdc || '0'),
        eth: parseFloat(balance.eth || '0'),
        address
      };
    } catch (error) {
      console.error('Failed to get balance:', error);
      return { usdc: 0, eth: 0, address };
    }
  }
  
  /**
   * Pay for a service using x402
   */
  async payForService(
    agentWallet: AgentWallet,
    serviceEndpoint: string,
    serviceData: any
  ): Promise<PaymentResult> {
    try {
      // Step 1: Try calling service without payment
      // Server will respond with 402 if payment required
      const initialResponse = await fetch(serviceEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serviceData)
      });
      
      // If already paid or free, return result
      if (initialResponse.status === 200) {
        return {
          success: true,
          paid: false,
          data: await initialResponse.json()
        };
      }
      
      // Step 2: Handle 402 Payment Required
      if (initialResponse.status === 402) {
        const paymentRequirements = await initialResponse.json();
        
        console.log(`Payment required: ${paymentRequirements.amount} USDC`);
        
        // Step 3: Sign payment authorization (gasless)
        const authorization = await this.signPayment(agentWallet, {
          amount: paymentRequirements.amount,
          receiver: paymentRequirements.receiver,
          deadline: Date.now() + 300000 // 5 minutes
        });
        
        // Step 4: Retry with payment
        const paidResponse = await fetch(serviceEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-PAYMENT': JSON.stringify(authorization)
          },
          body: JSON.stringify(serviceData)
        });
        
        if (!paidResponse.ok) {
          throw new Error(`Payment failed: ${paidResponse.statusText}`);
        }
        
        const result = await paidResponse.json();
        
        // Step 5: Log payment to Memory Bridge
        await this.logToMemory(agentWallet.agentId, {
          content: `Paid ${paymentRequirements.amount} USDC for service at ${serviceEndpoint}`,
          content_type: 'action',
          metadata: {
            serviceEndpoint,
            amount: paymentRequirements.amount,
            receiver: paymentRequirements.receiver,
            txHash: result.txHash,
            action: 'payment_sent',
            network: this.network
          }
        });
        
        return {
          success: true,
          paid: true,
          amount: paymentRequirements.amount,
          txHash: result.txHash,
          data: result.data
        };
      }
      
      throw new Error(`Unexpected response: ${initialResponse.status}`);
    } catch (error) {
      console.error('Payment failed:', error);
      
      // Log failure
      await this.logToMemory(agentWallet.agentId, {
        content: `Payment failed for ${serviceEndpoint}: ${error.message}`,
        content_type: 'error',
        metadata: {
          serviceEndpoint,
          error: error.message,
          action: 'payment_failed'
        }
      });
      
      throw error;
    }
  }
  
  /**
   * Sign payment authorization (gasless via ERC-3009)
   */
  private async signPayment(
    wallet: AgentWallet,
    params: {
      amount: string;
      receiver: string;
      deadline: number;
    }
  ): Promise<PaymentAuthorization> {
    // This would use AgentKit's signing capabilities
    // Implementation depends on specific AgentKit version
    return {
      from: wallet.address,
      to: params.receiver,
      value: params.amount,
      validAfter: Math.floor(Date.now() / 1000),
      validBefore: Math.floor(params.deadline / 1000),
      nonce: this.generateNonce(),
      // Signature would be added here
      signature: '0x...'
    };
  }
  
  /**
   * Transfer between agents
   */
  async transferBetweenAgents(
    fromAgentId: string,
    toAgentId: string,
    toAddress: string,
    amount: number,
    reason: string
  ): Promise<PaymentResult> {
    try {
      // Get sender wallet
      const fromWallet = await this.getWallet(fromAgentId);
      
      // Execute transfer
      const tx = await this.agentKit.sendTransaction({
        from: fromWallet.address,
        to: toAddress,
        amount: amount.toString(),
        asset: 'USDC'
      });
      
      // Log for sender
      await this.logToMemory(fromAgentId, {
        content: `Sent ${amount} USDC to agent ${toAgentId}: ${reason}`,
        content_type: 'action',
        metadata: {
          toAgentId,
          toAddress,
          amount,
          reason,
          txHash: tx.hash,
          action: 'transfer_sent',
          network: this.network
        }
      });
      
      // Log for receiver
      await this.logToMemory(toAgentId, {
        content: `Received ${amount} USDC from agent ${fromAgentId}: ${reason}`,
        content_type: 'action',
        metadata: {
          fromAgentId,
          fromAddress: fromWallet.address,
          amount,
          reason,
          txHash: tx.hash,
          action: 'transfer_received',
          network: this.network
        }
      });
      
      return {
        success: true,
        paid: true,
        amount,
        txHash: tx.hash
      };
    } catch (error) {
      console.error('Transfer failed:', error);
      throw error;
    }
  }
  
  /**
   * Log to Memory Bridge
   */
  private async logToMemory(agentId: string, data: any): Promise<void> {
    try {
      await storeMemory(agentId, data.content, data.content_type, data.metadata);
    } catch (error) {
      // Don't fail payment if logging fails
      console.error('Failed to log to Memory Bridge:', error);
    }
  }
  
  /**
   * Generate unique nonce for payments
   */
  private generateNonce(): string {
    return `0x${Array.from({ length: 64 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('')}`;
  }
  
  /**
   * Get wallet for agent (from Memory Bridge or create)
   */
  private async getWallet(agentId: string): Promise<any> {
    // Query Memory Bridge for wallet
    // Implementation depends on your query function
    // For now, return placeholder
    return { address: '0x...' };
  }
}

// Types
export interface AgentWallet {
  agentId: string;
  address: string;
  network: string;
  getBalance: () => Promise<WalletBalance>;
  signPayment: (params: any) => Promise<PaymentAuthorization>;
}

export interface WalletBalance {
  usdc: number;
  eth: number;
  address: string;
}

export interface PaymentAuthorization {
  from: string;
  to: string;
  value: string;
  validAfter: number;
  validBefore: number;
  nonce: string;
  signature: string;
}

export interface PaymentResult {
  success: boolean;
  paid: boolean;
  amount?: number;
  txHash?: string;
  data?: any;
}

export default AgentMoltPayments;
