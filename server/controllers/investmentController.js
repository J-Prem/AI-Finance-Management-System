import Investment from '../models/Investment.js';
import investmentService from '../services/investmentService.js';
import logger from '../utils/logger.js';

/**
 * Create investment
 */
export const createInvestment = async (req, res) => {
  try {
    const userId = req.user._id;
    const { type, name, symbol, quantity, buyPrice, buyDate, currency } =
      req.body;

    if (!type || !name || !symbol || quantity === undefined || !buyPrice || !buyDate) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
      });
    }

    const investment = await Investment.create({
      userId,
      type,
      name,
      symbol,
      quantity: parseFloat(quantity),
      buyPrice: parseFloat(buyPrice),
      buyDate: new Date(buyDate),
      currency: currency || 'INR',
      ...req.body,
    });

    res.status(201).json({
      success: true,
      message: 'Investment created successfully',
      data: investment,
    });
  } catch (error) {
    logger.error('Error creating investment:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to create investment',
      error: error.message,
    });
  }
};

/**
 * Get all investments for user
 */
export const getInvestments = async (req, res) => {
  try {
    const userId = req.user._id;
    const { type, isActive = true, page = 1, limit = 20 } = req.query;

    const query = { userId, isActive: isActive === 'true' };
    if (type) query.type = type;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const investments = await Investment.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Investment.countDocuments(query);

    res.json({
      success: true,
      data: investments,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    logger.error('Error fetching investments:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to fetch investments',
      error: error.message,
    });
  }
};

/**
 * Get single investment
 */
export const getInvestment = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const investment = await Investment.findOne({
      _id: id,
      userId,
    });

    if (!investment) {
      return res.status(404).json({
        success: false,
        message: 'Investment not found',
      });
    }

    res.json({
      success: true,
      data: investment,
    });
  } catch (error) {
    logger.error('Error fetching investment:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to fetch investment',
      error: error.message,
    });
  }
};

/**
 * Update investment
 */
export const updateInvestment = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const investment = await Investment.findOneAndUpdate(
      { _id: id, userId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!investment) {
      return res.status(404).json({
        success: false,
        message: 'Investment not found',
      });
    }

    res.json({
      success: true,
      message: 'Investment updated successfully',
      data: investment,
    });
  } catch (error) {
    logger.error('Error updating investment:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to update investment',
      error: error.message,
    });
  }
};

/**
 * Delete investment
 */
export const deleteInvestment = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const investment = await Investment.findOneAndUpdate(
      { _id: id, userId },
      { isActive: false },
      { new: true }
    );

    if (!investment) {
      return res.status(404).json({
        success: false,
        message: 'Investment not found',
      });
    }

    res.json({
      success: true,
      message: 'Investment deleted successfully',
      data: investment,
    });
  } catch (error) {
    logger.error('Error deleting investment:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to delete investment',
      error: error.message,
    });
  }
};

/**
 * Get portfolio summary
 */
export const getPortfolioSummary = async (req, res) => {
  try {
    const userId = req.user._id;

    const portfolio = await Investment.getPortfolioSummary(userId);
    const breakdown = await Investment.getByTypeBreakdown(userId);

    const summary = portfolio[0] || {
      totalCost: 0,
      totalValue: 0,
      totalPnL: 0,
      investmentCount: 0,
    };

    res.json({
      success: true,
      data: {
        ...summary,
        breakdown,
      },
    });
  } catch (error) {
    logger.error('Error fetching portfolio summary:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to fetch portfolio summary',
      error: error.message,
    });
  }
};

/**
 * Get portfolio diversification
 */
export const getPortfolioDiversification = async (req, res) => {
  try {
    const userId = req.user._id;

    const investments = await Investment.find({
      userId,
      isActive: true,
    });

    const diversification = await investmentService.calculatePortfolioDiversification(
      investments
    );

    res.json({
      success: true,
      data: diversification,
    });
  } catch (error) {
    logger.error('Error calculating portfolio diversification:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to calculate portfolio diversification',
      error: error.message,
    });
  }
};

/**
 * Get portfolio value (with current prices)
 */
export const getPortfolioValue = async (req, res) => {
  try {
    const userId = req.user._id;

    const investments = await Investment.find({
      userId,
      isActive: true,
    });

    const portfolio = await investmentService.calculatePortfolioValue(
      investments
    );

    res.json({
      success: true,
      data: portfolio,
    });
  } catch (error) {
    logger.error('Error calculating portfolio value:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to calculate portfolio value',
      error: error.message,
    });
  }
};

/**
 * Update investment price
 */
export const updateInvestmentPrice = async (req, res) => {
  try {
    const { id } = req.params;
    const { currentPrice } = req.body;
    const userId = req.user._id;

    if (currentPrice === undefined) {
      return res.status(400).json({
        success: false,
        message: 'currentPrice is required',
      });
    }

    const investment = await Investment.findOne({
      _id: id,
      userId,
    });

    if (!investment) {
      return res.status(404).json({
        success: false,
        message: 'Investment not found',
      });
    }

    investment.updatePrice(parseFloat(currentPrice));
    await investment.save();

    res.json({
      success: true,
      message: 'Investment price updated successfully',
      data: investment,
    });
  } catch (error) {
    logger.error('Error updating investment price:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to update investment price',
      error: error.message,
    });
  }
};

/**
 * Sell investment
 */
export const sellInvestment = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, sellPrice } = req.body;
    const userId = req.user._id;

    if (quantity === undefined || sellPrice === undefined) {
      return res.status(400).json({
        success: false,
        message: 'quantity and sellPrice are required',
      });
    }

    const investment = await Investment.findOne({
      _id: id,
      userId,
    });

    if (!investment) {
      return res.status(404).json({
        success: false,
        message: 'Investment not found',
      });
    }

    investment.sell(parseFloat(quantity), parseFloat(sellPrice));
    await investment.save();

    res.json({
      success: true,
      message: 'Investment sold successfully',
      data: investment,
    });
  } catch (error) {
    logger.error('Error selling investment:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to sell investment',
      error: error.message,
    });
  }
};
