import reportService from '../services/reportService.js';
import logger from '../utils/logger.js';

/**
 * Get monthly report
 */
export const getMonthlyReport = async (req, res) => {
  try {
    const { year, month } = req.params;
    const userId = req.user._id;

    if (!year || !month) {
      return res.status(400).json({
        success: false,
        message: 'Year and month are required',
      });
    }

    const yearNum = parseInt(year);
    const monthNum = parseInt(month);

    if (monthNum < 1 || monthNum > 12) {
      return res.status(400).json({
        success: false,
        message: 'Month must be between 1 and 12',
      });
    }

    const report = await reportService.generateMonthlyReport(
      userId,
      monthNum,
      yearNum
    );

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    logger.error('Error generating monthly report:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to generate monthly report',
      error: error.message,
    });
  }
};

/**
 * Get annual report
 */
export const getAnnualReport = async (req, res) => {
  try {
    const { year } = req.params;
    const userId = req.user._id;

    if (!year) {
      return res.status(400).json({
        success: false,
        message: 'Year is required',
      });
    }

    const yearNum = parseInt(year);

    const report = await reportService.generateTaxReport(userId, yearNum);

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    logger.error('Error generating annual report:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to generate annual report',
      error: error.message,
    });
  }
};

/**
 * Get budget report
 */
export const getBudgetReport = async (req, res) => {
  try {
    const userId = req.user._id;

    const report = await reportService.generateBudgetReport(userId);

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    logger.error('Error generating budget report:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to generate budget report',
      error: error.message,
    });
  }
};

/**
 * Get tax report
 */
export const getTaxReport = async (req, res) => {
  try {
    const { year } = req.params;
    const userId = req.user._id;

    if (!year) {
      return res.status(400).json({
        success: false,
        message: 'Year is required',
      });
    }

    const yearNum = parseInt(year);
    const report = await reportService.generateTaxReport(userId, yearNum);

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    logger.error('Error generating tax report:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to generate tax report',
      error: error.message,
    });
  }
};

/**
 * Get custom date range report
 */
export const getCustomReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const userId = req.user._id;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'startDate and endDate are required',
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Use ISO 8601 format (YYYY-MM-DD)',
      });
    }

    if (start > end) {
      return res.status(400).json({
        success: false,
        message: 'startDate must be before endDate',
      });
    }

    const report = await reportService.generateCustomReport(userId, start, end);

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    logger.error('Error generating custom report:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to generate custom report',
      error: error.message,
    });
  }
};

/**
 * Export report as JSON or CSV
 */
export const exportReport = async (req, res) => {
  try {
    const { type, format = 'json' } = req.body;
    const { year, month } = req.body;
    const userId = req.user._id;

    if (!type) {
      return res.status(400).json({
        success: false,
        message: 'Report type is required',
      });
    }

    let reportData;

    switch (type) {
      case 'monthly':
        if (!year || !month) {
          throw new Error('Year and month required for monthly reports');
        }
        reportData = await reportService.generateMonthlyReport(
          userId,
          parseInt(month),
          parseInt(year)
        );
        break;

      case 'annual':
        if (!year) {
          throw new Error('Year required for annual reports');
        }
        reportData = await reportService.generateTaxReport(
          userId,
          parseInt(year)
        );
        break;

      case 'budget':
        reportData = await reportService.generateBudgetReport(userId);
        break;

      default:
        throw new Error('Invalid report type');
    }

    if (format === 'csv') {
      const csv = convertToCSV(reportData);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="report-${type}-${Date.now()}.csv"`
      );
      res.send(csv);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="report-${type}-${Date.now()}.json"`
      );
      res.json(reportData);
    }
  } catch (error) {
    logger.error('Error exporting report:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to export report',
      error: error.message,
    });
  }
};

/**
 * Convert object to CSV
 * @private
 */
function convertToCSV(data) {
  if (!data || typeof data !== 'object') {
    return '';
  }

  const headers = Object.keys(data);
  const values = headers.map((header) => {
    const value = data[header];
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return value || '';
  });

  const csvContent = [
    headers.join(','),
    values.map((v) => `"${v}"`).join(','),
  ].join('\n');

  return csvContent;
}
