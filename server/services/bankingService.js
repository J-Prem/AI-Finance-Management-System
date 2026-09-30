import axios from 'axios';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { API_CONFIG } from '../config/apis.js';
import logger from '../utils/logger.js';

class BankingService {
  constructor() {
    this.razorpay = new Razorpay({
      key_id: API_CONFIG.RAZORPAY.keyId,
      key_secret: API_CONFIG.RAZORPAY.keySecret,
    });
  }

  /**
   * Create Razorpay order
   */
  async createRazorpayOrder(amount, currency = 'INR', description = 'Payment') {
    try {
      if (!API_CONFIG.RAZORPAY.keyId || !API_CONFIG.RAZORPAY.keySecret) {
        throw new Error('Razorpay credentials not configured');
      }

      const order = await this.razorpay.orders.create({
        amount: Math.round(amount * 100), // Convert to paise
        currency,
        description,
        notes: {
          project_name: 'AI Finance Management',
        },
      });

      logger.info(`Razorpay order created: ${order.id}`);

      return {
        orderId: order.id,
        amount: order.amount / 100,
        currency: order.currency,
        status: order.status,
        createdAt: new Date(order.created_at * 1000),
      };
    } catch (error) {
      logger.error('Error creating Razorpay order:', error);
      throw error;
    }
  }

  /**
   * Verify Razorpay payment
   */
  async verifyRazorpayPayment(orderId, paymentId, signature) {
    try {
      if (!API_CONFIG.RAZORPAY.keySecret) {
        throw new Error('Razorpay secret not configured');
      }

      const hmac = crypto.createHmac('sha256', API_CONFIG.RAZORPAY.keySecret);
      hmac.update(orderId + '|' + paymentId);
      const generated_signature = hmac.digest('hex');

      if (generated_signature !== signature) {
        logger.warn(`Invalid payment signature for order ${orderId}`);
        return {
          verified: false,
          message: 'Invalid payment signature',
        };
      }

      const payment = await this.razorpay.payments.fetch(paymentId);

      logger.info(`Payment verified: ${paymentId}`);

      return {
        verified: true,
        paymentId,
        orderId,
        amount: payment.amount / 100,
        currency: payment.currency,
        status: payment.status,
        method: payment.method,
        verifiedAt: new Date(),
      };
    } catch (error) {
      logger.error('Error verifying Razorpay payment:', error);
      throw error;
    }
  }

  /**
   * Get UPI payment status
   */
  async getUPIPaymentStatus(paymentId) {
    try {
      const payment = await this.razorpay.payments.fetch(paymentId);

      return {
        paymentId,
        status: payment.status,
        method: payment.method,
        upi: payment.vpa,
        amount: payment.amount / 100,
        currency: payment.currency,
        createdAt: new Date(payment.created_at * 1000),
      };
    } catch (error) {
      logger.error(`Error getting UPI payment status for ${paymentId}:`, error);
      throw error;
    }
  }

  /**
   * Parse bank statement from uploaded file
   */
  async parseBankStatement(fileBuffer, bankName) {
    try {
      const fileContent = fileBuffer.toString('utf-8');

      // Route to appropriate parser based on bank
      let statement;
      switch (bankName.toUpperCase()) {
        case 'SBI':
          statement = this._parseSBIStatement(fileContent);
          break;
        case 'HDFC':
          statement = this._parseHDFCStatement(fileContent);
          break;
        case 'ICICI':
          statement = this._parseICICIStatement(fileContent);
          break;
        case 'AXIS':
          statement = this._parseAxisStatement(fileContent);
          break;
        default:
          throw new Error(`Parser not available for ${bankName}`);
      }

      return statement;
    } catch (error) {
      logger.error(`Error parsing ${bankName} statement:`, error);
      throw error;
    }
  }

  /**
   * Auto-detect bank from statement
   */
  async detectBank(fileContent) {
    // Simple detection based on content
    const content = fileContent.toLowerCase();

    if (content.includes('state bank of india')) return 'SBI';
    if (content.includes('hdfc')) return 'HDFC';
    if (content.includes('icici')) return 'ICICI';
    if (content.includes('axis')) return 'AXIS';

    return null;
  }

  /**
   * Parse SBI statement
   * @private
   */
  _parseSBIStatement(content) {
    const lines = content.split('\n');
    const transactions = [];
    let isTransactionSection = false;

    for (const line of lines) {
      // Skip header and footer
      if (line.includes('Date') && line.includes('Amount')) {
        isTransactionSection = true;
        continue;
      }

      if (isTransactionSection && line.trim()) {
        const parts = line.split(/\s{2,}/);
        if (parts.length >= 4) {
          try {
            transactions.push({
              date: new Date(parts[0]),
              description: parts[1],
              amount: parseFloat(parts[2]),
              balance: parseFloat(parts[3]),
              type: parts[2].startsWith('-') ? 'expense' : 'income',
            });
          } catch (error) {
            logger.debug(`Could not parse SBI transaction line: ${line}`);
          }
        }
      }
    }

    return {
      bank: 'SBI',
      transactions,
      totalTransactions: transactions.length,
      dateRange: {
        start: transactions[0]?.date,
        end: transactions[transactions.length - 1]?.date,
      },
    };
  }

  /**
   * Parse HDFC statement
   * @private
   */
  _parseHDFCStatement(content) {
    const lines = content.split('\n');
    const transactions = [];
    let isTransactionSection = false;

    for (const line of lines) {
      if (line.includes('Txn Date')) {
        isTransactionSection = true;
        continue;
      }

      if (isTransactionSection && line.trim()) {
        const parts = line.split(',');
        if (parts.length >= 4) {
          try {
            transactions.push({
              date: new Date(parts[0].trim()),
              description: parts[1].trim(),
              amount: Math.abs(parseFloat(parts[2])),
              balance: parseFloat(parts[3]),
              type: parseFloat(parts[2]) < 0 ? 'expense' : 'income',
            });
          } catch (error) {
            logger.debug(`Could not parse HDFC transaction line: ${line}`);
          }
        }
      }
    }

    return {
      bank: 'HDFC',
      transactions,
      totalTransactions: transactions.length,
      dateRange: {
        start: transactions[0]?.date,
        end: transactions[transactions.length - 1]?.date,
      },
    };
  }

  /**
   * Parse ICICI statement
   * @private
   */
  _parseICICIStatement(content) {
    const lines = content.split('\n');
    const transactions = [];
    let isTransactionSection = false;

    for (const line of lines) {
      if (line.includes('Transaction Date')) {
        isTransactionSection = true;
        continue;
      }

      if (isTransactionSection && line.trim()) {
        const parts = line.split(/\s{2,}/);
        if (parts.length >= 4) {
          try {
            transactions.push({
              date: new Date(parts[0]),
              description: parts[1],
              amount: Math.abs(parseFloat(parts[2])),
              balance: parseFloat(parts[3]),
              type: parseFloat(parts[2]) < 0 ? 'expense' : 'income',
            });
          } catch (error) {
            logger.debug(`Could not parse ICICI transaction line: ${line}`);
          }
        }
      }
    }

    return {
      bank: 'ICICI',
      transactions,
      totalTransactions: transactions.length,
      dateRange: {
        start: transactions[0]?.date,
        end: transactions[transactions.length - 1]?.date,
      },
    };
  }

  /**
   * Parse Axis statement
   * @private
   */
  _parseAxisStatement(content) {
    const lines = content.split('\n');
    const transactions = [];
    let isTransactionSection = false;

    for (const line of lines) {
      if (line.includes('Value Date')) {
        isTransactionSection = true;
        continue;
      }

      if (isTransactionSection && line.trim()) {
        const parts = line.split(',');
        if (parts.length >= 4) {
          try {
            transactions.push({
              date: new Date(parts[0].trim()),
              description: parts[1].trim(),
              amount: Math.abs(parseFloat(parts[2])),
              balance: parseFloat(parts[3]),
              type: parseFloat(parts[2]) < 0 ? 'expense' : 'income',
            });
          } catch (error) {
            logger.debug(`Could not parse Axis transaction line: ${line}`);
          }
        }
      }
    }

    return {
      bank: 'AXIS',
      transactions,
      totalTransactions: transactions.length,
      dateRange: {
        start: transactions[0]?.date,
        end: transactions[transactions.length - 1]?.date,
      },
    };
  }
}

export default new BankingService();
